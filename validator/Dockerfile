# Internal validation service.
#
# This image runs:
#   - the Node.js validator API
#   - KoSIT for XRechnung validation
#   - Mustang for ZUGFeRD / Factur-X validation
#   - veraPDF for PDF/A validation
#
# The running validator container has no public port and no outbound internet access.
# docker-compose.yml places it only on the internal `validation` network.
#
# Because the runtime container cannot download anything, all validator binaries and
# configurations are downloaded while the Docker image is being built.
#
# Every downloaded file is:
#   1. pinned to an exact version
#   2. checked against a known SHA-256 checksum
#
# If a downloaded file differs from the expected file, the Docker build fails.
#
# These versions and checksums should stay in sync with:
#   scripts/setup-kosit.sh
#   scripts/setup-mustang.sh
#   scripts/setup-verapdf.sh
# in the openinvoicexml engine repository.
#
# When upgrading a validator:
#   - update the version here
#   - update its SHA-256 checksum
#   - update the corresponding engine setup script
#
# The version numbers are later copied into runtime ENV variables so the API can
# report exactly which validators produced a validation result.

ARG KOSIT_VERSION=1.6.2
ARG KOSIT_SHA256=244978514ad48f67c7573acfffc8f4fd73d81feda6f276710033f9913579857e

# KoSIT itself and the XRechnung validation configuration are separate projects.
# KoSIT is the validation engine; this configuration contains the XRechnung
# scenarios/rules that KoSIT executes.
ARG XRECHNUNG_CONFIG_VERSION=2026-01-31
ARG XRECHNUNG_CONFIG_SHA256=6a5a5911a421b25fbc423f62f93f894df7b236f5d73ca4f84bb222a945082704

ARG MUSTANG_VERSION=2.26.0
ARG MUSTANG_SHA256=42d7868cb68264874a7b8cab4c3587b03b23ccc7cd72373da917f66758bb9736

ARG VERAPDF_VERSION=1.30.2
ARG VERAPDF_SHA256=6cc6341cb1af644044054b81f00a6590a7918abb18f762243de115258bcad838


# ---------------------------------------------------------------------------
# Stage 1: Build the Node.js / TypeScript validator service
# ---------------------------------------------------------------------------
#
# This stage contains development dependencies such as TypeScript.
# It is used only to compile src/ into dist/.
#
# The final runtime image does not inherit this whole stage, so build-only
# dependencies do not end up in production.

FROM node:20-alpine AS build

# All application build work happens under /app.
WORKDIR /app

# Copy package metadata first.
#
# Keeping this separate from COPY src allows Docker to reuse the npm-install
# layer when application source changes but package.json/package-lock.json do not.
COPY package*.json ./

# openinvoicexml is installed as a local package such as:
#
#   file:vendor/openinvoicexml-0.4.3.tgz
#
# npm therefore needs vendor/ to exist before `npm ci` runs.
COPY vendor ./vendor

# Install the exact dependency versions recorded in package-lock.json.
#
# This includes development dependencies because TypeScript/build tooling is
# needed in this build stage.
RUN npm ci

# Copy TypeScript compiler configuration.
COPY tsconfig.json tsconfig.build.json ./

# Copy the validator service source code.
COPY src ./src

# Compile TypeScript into JavaScript.
#
# The generated production files are placed in /app/dist and copied into the
# final runtime image later.
RUN npm run build


# ---------------------------------------------------------------------------
# Stage 2: Download and prepare external validator tools
# ---------------------------------------------------------------------------
#
# This stage exists only to construct /opt/validators.
#
# It downloads:
#   - KoSIT
#   - XRechnung validator configuration
#   - Mustang CLI
#   - veraPDF CLI
#
# curl, unzip and installation files are needed here, but they do not need to
# exist in the final production image.

FROM alpine:3.20 AS validators

# ARG values declared before the first FROM are global enough to select FROM
# images, but build arguments must be declared again inside a stage before they
# can be used by RUN commands in that stage.
ARG KOSIT_VERSION
ARG KOSIT_SHA256
ARG XRECHNUNG_CONFIG_VERSION
ARG XRECHNUNG_CONFIG_SHA256
ARG MUSTANG_VERSION
ARG MUSTANG_SHA256
ARG VERAPDF_VERSION
ARG VERAPDF_SHA256

# Tools needed only while preparing the validators:
#
#   curl        download release files
#   unzip       unpack XRechnung and veraPDF archives
#   Java 17 JRE run the veraPDF installer and Java-based validators if needed
RUN apk add --no-cache curl unzip openjdk17-jre-headless

# Keep all validator software under one predictable directory.
WORKDIR /opt/validators

RUN set -eu; \
    \
    # `set -e` stops immediately if any command fails.
    # `set -u` treats use of an undefined shell variable as an error.
    \
    # Create directories for validators that are downloaded as individual JARs.
    mkdir -p kosit mustang; \
    \
    # -----------------------------------------------------------------------
    # KoSIT
    # -----------------------------------------------------------------------
    \
    # Download the exact pinned standalone KoSIT JAR.
    curl -fsSL -o kosit/validator.jar \
      "https://github.com/itplr-kosit/validator/releases/download/v${KOSIT_VERSION}/validator-${KOSIT_VERSION}-standalone.jar"; \
    \
    # Verify that the downloaded JAR exactly matches the expected SHA-256.
    # `sha256sum -c` exits with an error if it does not match, failing the build.
    echo "${KOSIT_SHA256}  kosit/validator.jar" | sha256sum -c -; \
    \
    # -----------------------------------------------------------------------
    # XRechnung validation configuration for KoSIT
    # -----------------------------------------------------------------------
    \
    # KoSIT is the validation engine; this ZIP contains the XRechnung
    # scenarios, schemas and Schematron configuration it runs.
    curl -fsSL -o /tmp/config.zip \
      "https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v${XRECHNUNG_CONFIG_VERSION}/xrechnung-3.0.2-validator-configuration-${XRECHNUNG_CONFIG_VERSION}.zip"; \
    \
    # Verify the downloaded configuration archive before extracting it.
    echo "${XRECHNUNG_CONFIG_SHA256}  /tmp/config.zip" | sha256sum -c -; \
    \
    # Extract it into the directory KoSIT will use at runtime.
    unzip -q /tmp/config.zip -d kosit/config; \
    \
    # -----------------------------------------------------------------------
    # Mustang
    # -----------------------------------------------------------------------
    \
    # Download the exact pinned Mustang CLI JAR.
    curl -fsSL -o mustang/mustang-cli.jar \
      "https://github.com/ZUGFeRD/mustangproject/releases/download/core-${MUSTANG_VERSION}/Mustang-CLI-${MUSTANG_VERSION}.jar"; \
    \
    # Verify the Mustang JAR before it becomes part of the image.
    echo "${MUSTANG_SHA256}  mustang/mustang-cli.jar" | sha256sum -c -; \
    \
    # -----------------------------------------------------------------------
    # veraPDF
    # -----------------------------------------------------------------------
    \
    # veraPDF is distributed as an installer ZIP instead of one standalone JAR.
    #
    # `${VERAPDF_VERSION%.*}` removes the final `.patch` part:
    #
    #   1.30.2 -> 1.30
    #
    # because veraPDF groups downloads under a major/minor release directory.
    curl -fsSL -o /tmp/verapdf.zip \
      "https://software.verapdf.org/releases/${VERAPDF_VERSION%.*}/verapdf-greenfield-${VERAPDF_VERSION}-installer.zip"; \
    \
    # Verify the installer archive.
    echo "${VERAPDF_SHA256}  /tmp/verapdf.zip" | sha256sum -c -; \
    \
    # Extract the veraPDF installer into a temporary directory.
    unzip -q /tmp/verapdf.zip -d /tmp/verapdf-installer; \
    \
    # veraPDF uses an IzPack installer.
    #
    # Generate an automated installation XML file so installation can happen
    # non-interactively during `docker build`.
    #
    # Only the CLI package is selected because the server does not need:
    #   - the graphical interface
    #   - documentation
    #   - sample plugins
    printf '%s\n' \
      '<AutomatedInstallation langpack="eng">' \
      '  <com.izforge.izpack.panels.htmlhello.HTMLHelloPanel id="welcome"/>' \
      '  <com.izforge.izpack.panels.target.TargetPanel id="install_dir"><installpath>/opt/validators/verapdf</installpath></com.izforge.izpack.panels.target.TargetPanel>' \
      '  <com.izforge.izpack.panels.packs.PacksPanel id="sdk_pack_select">' \
      '    <pack index="0" name="veraPDF GUI" selected="false"/>' \
      '    <pack index="1" name="veraPDF CLI" selected="true"/>' \
      '    <pack index="2" name="veraPDF Documentation" selected="false"/>' \
      '    <pack index="3" name="veraPDF Sample Plugins" selected="false"/>' \
      '  </com.izforge.izpack.panels.packs.PacksPanel>' \
      '  <com.izforge.izpack.panels.install.InstallPanel id="install"/>' \
      '  <com.izforge.izpack.panels.finish.FinishPanel id="finish"/>' \
      '</AutomatedInstallation>' > /tmp/verapdf-auto-install.xml; \
    \
    # Run the veraPDF installer using the automated installation file above.
    java -jar "/tmp/verapdf-installer/verapdf-greenfield-${VERAPDF_VERSION}/verapdf-izpack-installer-${VERAPDF_VERSION}.jar" \
      /tmp/verapdf-auto-install.xml; \
    \
    # The running service never needs the veraPDF uninstaller or any of the
    # temporary downloads/install files, so remove them before this stage is copied.
    rm -rf /opt/validators/verapdf/Uninstaller /tmp/*


# ---------------------------------------------------------------------------
# Stage 3: Final production runtime image
# ---------------------------------------------------------------------------
#
# Start from a fresh Node image instead of using the build stage directly.
#
# Only the files needed at runtime are copied into this image:
#   - production Node dependencies
#   - compiled application JavaScript
#   - prepared validator binaries/configuration
#   - Java runtime
#
# Build tools, TypeScript source, curl, unzip and installer files stay behind.

FROM node:20-alpine AS runtime

# These are needed only as version metadata at runtime.
#
# Checksums do not need to be re-declared because downloads already happened
# and were verified in the `validators` stage.
ARG KOSIT_VERSION
ARG XRECHNUNG_CONFIG_VERSION
ARG MUSTANG_VERSION
ARG VERAPDF_VERSION

# KoSIT and Mustang run on Java, so Java must also exist in the final image.
#
# `headless` avoids installing graphical desktop components that a server does
# not need.
RUN apk add --no-cache openjdk17-jre-headless

# Runtime configuration.
#
# NODE_ENV=production
#   tells Node libraries that this is a production environment.
#
# PORT
#   internal HTTP port used by this validator service.
#
# JOB_ROOT
#   temporary working area for uploaded invoice validation jobs.
#   docker-compose mounts /jobs as tmpfs, so invoice files stay in memory
#   rather than being written to persistent container storage.
#
# KOSIT_JAR, KOSIT_SCENARIOS, MUSTANG_JAR, VERAPDF_CLI
#   tell the Node service where each external validator is installed.
#
# *_VERSION
#   lets the service include validator versions in API results/logging so a
#   validation result can be tied to the exact validator stack that produced it.
ENV NODE_ENV=production \
    PORT=4000 \
    JOB_ROOT=/jobs \
    KOSIT_JAR=/opt/validators/kosit/validator.jar \
    KOSIT_SCENARIOS=/opt/validators/kosit/config/scenarios.xml \
    MUSTANG_JAR=/opt/validators/mustang/mustang-cli.jar \
    VERAPDF_CLI=/opt/validators/verapdf/verapdf \
    KOSIT_VERSION=${KOSIT_VERSION} \
    XRECHNUNG_CONFIG_VERSION=${XRECHNUNG_CONFIG_VERSION} \
    MUSTANG_VERSION=${MUSTANG_VERSION} \
    VERAPDF_VERSION=${VERAPDF_VERSION}

# Application directory inside the final container.
WORKDIR /app

# Copy dependency metadata first so Docker can cache npm installation separately
# from application code.
COPY package*.json ./

# The production dependency graph still contains the local packaged
# openinvoicexml engine, so vendor/ must exist before npm ci.
COPY vendor ./vendor

# Install only runtime dependencies.
#
# Development dependencies such as TypeScript and test tools are omitted because
# compilation already happened in the `build` stage.
RUN npm ci --omit=dev

# Copy only the compiled JavaScript from Stage 1.
#
# src/ and build tooling do not need to exist in the runtime image.
COPY --from=build /app/dist ./dist

# Copy the already downloaded, verified and prepared validators from Stage 2.
COPY --from=validators /opt/validators /opt/validators

# Create the job directory and give ownership to the non-root Node user.
#
# docker-compose later mounts a tmpfs at /jobs, but creating it here documents
# the expected path and gives the image sensible ownership by default.
RUN mkdir /jobs && chown node:node /jobs

# Do not run the validation service as root.
#
# `node` is the unprivileged user included by the official Node image.
#
# docker-compose adds more restrictions:
#   - root filesystem is read-only
#   - /jobs and /tmp are tmpfs
#   - Linux capabilities are dropped
#   - no-new-privileges is enabled
#   - validator is attached only to the internal validation network
USER node

# Document that the application listens on TCP port 4000 inside the container.
#
# EXPOSE does NOT make this port public by itself.
# docker-compose intentionally does not publish validator:4000 to the host.
# The backend reaches it only through the internal Docker network.
EXPOSE 4000

# Start the compiled Node validator API.
CMD ["node", "dist/server.js"]