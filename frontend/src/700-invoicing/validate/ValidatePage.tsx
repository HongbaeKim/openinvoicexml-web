import { useRef, useState, type DragEvent, type JSX } from "react";
import { Header } from "../../100-layout/Header";
import { Footer } from "../../100-layout/Footer";
import { postBytes } from "../../000-core/api";
import { usePageMeta, useTranslation } from "../../000-core/i18n";
import { sha256Hex } from "../shared/sha256";
import { sizeLimit, sniff, type Sniffed } from "./sniff-file";
import { deriveUploadState, type UploadState } from "./upload-state";
import { ValidationReport } from "./ValidationReport";
import { validatePageDict } from "./ValidatePage.i18n";

// Validate an existing invoice file. Picking a file sends nothing: it's read once into `bytes`
// (the same bytes are hashed and uploaded), sniffed locally for the "Detected" line and the size
// check, and only uploaded when the user clicks [Validate] with the privacy notice in view.
// The file name stays in the browser; the server only ever sees the bytes.

const SECTION_CLASS = "rounded-[10px] border border-border bg-surface p-5";
const PRIMARY = "rounded-md bg-accent px-[1.4rem] py-[0.7rem] font-semibold text-accent-text disabled:opacity-60";
const SECONDARY = "rounded-md border border-border px-[1.4rem] py-[0.7rem] text-text hover:border-accent";
// Above nginx's proxy_read_timeout for /api/validate/upload.
const UPLOAD_TIMEOUT_MS = 160_000;

interface Picked {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
  sniffed: Sniffed;
}

type Phase =
  | { kind: "idle"; message?: string }
  | { kind: "picked"; file: Picked }
  | { kind: "validating"; file: Picked }
  | { kind: "done"; file: Picked; state: UploadState };

export function ValidatePage(): JSX.Element {
  const { t } = useTranslation(validatePageDict);
  usePageMeta({ title: t.metaTitle, description: t.metaDescription });
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const run = useRef(0);

  async function pick(file: File | undefined): Promise<void> {
    run.current++;
    if (!file) return;
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      setPhase({ kind: "idle", message: t.readFailed });
      return;
    }
    const sniffed = sniff(bytes.subarray(0, 4096));
    if (sniffed.family === "empty") return setPhase({ kind: "idle", message: t.empty });
    if (sniffed.family === "unsupported") return setPhase({ kind: "idle", message: t.unsupported });
    const limit = sizeLimit(sniffed);
    if (bytes.length > limit) {
      return setPhase({ kind: "idle", message: t.tooLarge(limit / 1024 / 1024) });
    }
    setPhase({ kind: "picked", file: { name: file.name, bytes, sniffed } });
  }

  async function validate(file: Picked): Promise<void> {
    const thisRun = ++run.current;
    setPhase({ kind: "validating", file });
    const [localSha256, answer] = await Promise.all([
      sha256Hex(file.bytes),
      postBytes("/api/validate/upload", file.bytes, "application/octet-stream", UPLOAD_TIMEOUT_MS),
    ]);
    if (thisRun !== run.current) return;
    setPhase({ kind: "done", file, state: deriveUploadState(answer, localSha256) });
  }

  function reset(): void {
    run.current++;
    setPhase({ kind: "idle" });
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(false);
    void pick(event.dataTransfer.files[0]);
  }

  function detectedLabel(sniffed: Sniffed): string {
    if (sniffed.family === "pdf") return t.detectedPdf;
    if (sniffed.family === "xml") {
      return sniffed.kind === "ubl" ? t.detectedUbl : sniffed.kind === "cii" ? t.detectedCii : t.detectedXml;
    }
    return "";
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[720px] space-y-8 px-5 pt-12 pb-20">
        <section>
          <h1 className="mb-3 text-[2.1rem] leading-[1.25] text-text">{t.heading}</h1>
          <p className="text-[1.05rem] text-text">{t.intro}</p>
          <p className="mb-0 rounded-md border border-border px-4 py-3 text-sm">{t.spikeNote}</p>
        </section>

        {phase.kind === "idle" && (
          <section>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`${SECTION_CLASS} border-dashed text-center ${dragging ? "border-accent" : ""}`}
            >
              <p className="mb-1 text-lg text-text">{t.dropTitle}</p>
              <p className="text-sm">{t.dropHint}</p>
              <input
                ref={input}
                type="file"
                accept=".xml,.pdf,application/xml,text/xml,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void pick(file);
                }}
              />
              <button type="button" className={SECONDARY} onClick={() => input.current?.click()}>
                {t.chooseFile}
              </button>
            </div>
            {phase.message && (
              <p role="status" className="mt-3 mb-0 text-sm text-danger">
                {phase.message}
              </p>
            )}
          </section>
        )}

        {(phase.kind === "picked" || phase.kind === "validating") && (
          <section className={SECTION_CLASS}>
            <p className="mb-1 break-all text-text">{phase.file.name}</p>
            <p className="text-sm">
              {t.detected}: {detectedLabel(phase.file.sniffed)}
            </p>
            <p className="text-sm text-text">{t.privacy}</p>
            {phase.kind === "validating" ? (
              <p role="status" className="mb-0 flex items-center gap-2 text-sm text-text">
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent"
                />
                {t.validating}
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button type="button" className={PRIMARY} onClick={() => void validate(phase.file)}>
                  {t.validate}
                </button>
                <button type="button" className={SECONDARY} onClick={reset}>
                  {t.chooseAnother}
                </button>
              </div>
            )}
          </section>
        )}

        {phase.kind === "done" && (
          <section role="status" className={SECTION_CLASS}>
            <Outcome state={phase.state} fileName={phase.file.name} t={t} />
            <div className="mt-4 flex flex-wrap gap-3">
              {(phase.state.kind === "INCOMPLETE" || phase.state.kind === "UNAVAILABLE") && (
                <button type="button" className={PRIMARY} onClick={() => void validate(phase.file)}>
                  {t.tryAgain}
                </button>
              )}
              <button type="button" className={SECONDARY} onClick={reset}>
                {t.validateAnother}
              </button>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

function Outcome({
  state,
  fileName,
  t,
}: {
  state: UploadState;
  fileName: string;
  t: (typeof validatePageDict)["de"];
}): JSX.Element {
  if ("report" in state) return <ValidationReport report={state.report} fileName={fileName} />;
  const text =
    state.kind === "INCOMPLETE"
      ? t.incomplete
      : state.kind === "TOO_LARGE"
        ? t.serverTooLarge
        : state.kind === "REJECTED"
          ? t.rejected
          : state.rateLimited
            ? t.rateLimited
            : t.unavailable;
  const color = state.kind === "TOO_LARGE" || state.kind === "REJECTED" ? "text-danger" : "text-warning";
  return <p className={`mb-0 ${color}`}>{text}</p>;
}
