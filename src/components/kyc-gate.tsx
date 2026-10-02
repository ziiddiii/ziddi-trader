import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Upload, Camera, Check, X, Loader2, ChevronLeft, IdCard, Hourglass, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ID_TYPES = [
  { id: "national_id", label: "National ID Number" },
  { id: "drivers_license", label: "Driving Licence" },
  { id: "passport", label: "Passport" },
] as const;

type UploadSlot = { file: File | null; preview: string | null };

export type KycStatus = "verified" | "pending" | "rejected";
export type KycRecord = {
  status: KycStatus;
  fullName?: string;
  idType?: string;
  idNumber?: string;
  rejectReason?: string | null;
};

export async function getKycRecord(userId: string | null | undefined): Promise<KycRecord | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("kyc_verifications")
    .select("status, full_name, id_type, id_number, reject_reason")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const status: KycStatus = data.status === "verified" ? "verified" : data.status === "rejected" ? "rejected" : "pending";
  return {
    status,
    fullName: data.full_name ?? undefined,
    idType: data.id_type ?? undefined,
    idNumber: data.id_number ?? undefined,
    rejectReason: data.reject_reason,
  };
}

export async function isKycVerified(userId: string | null | undefined): Promise<boolean> {
  const r = await getKycRecord(userId);
  return r?.status === "verified";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function KycGate({
  userId,
  fullNameDefault,
  onVerified,
  onCancel,
}: {
  userId: string;
  fullNameDefault?: string;
  onVerified: () => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<"form" | "face" | "submitting" | "pending" | "approved" | "rejected">("form");
  const [fullName, setFullName] = useState(fullNameDefault ?? "");
  const [idType, setIdType] = useState<(typeof ID_TYPES)[number]["id"]>("national_id");
  const [idNumber, setIdNumber] = useState("");
  const [front, setFront] = useState<UploadSlot>({ file: null, preview: null });
  const [back, setBack] = useState<UploadSlot>({ file: null, preview: null });
  const [rejectReason, setRejectReason] = useState<string | null>(null);

  const idLabel = ID_TYPES.find((t) => t.id === idType)?.label ?? "ID";

  const handleUpload = (which: "front" | "back") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("File must be under 8MB");
      return;
    }
    const preview = URL.createObjectURL(file);
    (which === "front" ? setFront : setBack)({ file, preview });
  };

  const clearUpload = (which: "front" | "back") => {
    const cur = which === "front" ? front : back;
    if (cur.preview) URL.revokeObjectURL(cur.preview);
    (which === "front" ? setFront : setBack)({ file: null, preview: null });
  };

  useEffect(() => {
    return () => {
      if (front.preview) URL.revokeObjectURL(front.preview);
      if (back.preview) URL.revokeObjectURL(back.preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On mount, if there's already a submission, jump to the right screen.
  useEffect(() => {
    let cancel = false;
    (async () => {
      const r = await getKycRecord(userId);
      if (cancel || !r) return;
      if (r.status === "verified") setStep("approved");
      else if (r.status === "pending") setStep("pending");
      else if (r.status === "rejected") { setRejectReason(r.rejectReason ?? null); setStep("rejected"); }
    })();
    return () => { cancel = true; };
  }, [userId]);

  // Poll for approval while pending.
  useEffect(() => {
    if (step !== "pending") return;
    const iv = setInterval(async () => {
      const r = await getKycRecord(userId);
      if (!r) return;
      if (r.status === "verified") setStep("approved");
      else if (r.status === "rejected") { setRejectReason(r.rejectReason ?? null); setStep("rejected"); }
    }, 4000);
    return () => clearInterval(iv);
  }, [step, userId]);

  const proceedToFace = () => {
    if (!fullName.trim() || fullName.trim().length < 3) return toast.error("Enter your full names");
    if (!idNumber.trim() || idNumber.trim().length < 4) return toast.error(`Enter your ${idLabel}`);
    if (!front.file) return toast.error("Upload the front of your document");
    if (idType !== "passport" && !back.file) return toast.error("Upload the back of your document");
    setStep("face");
  };

  const submitToServer = async (selfieDataUrl: string | null) => {
    setStep("submitting");
    try {
      const frontUrl = front.file ? await fileToDataUrl(front.file) : "";
      const backUrl = back.file ? await fileToDataUrl(back.file) : "";
      const { error } = await supabase.rpc("submit_kyc", {
        _full_name: fullName.trim(),
        _id_type: idType,
        _id_number: idNumber.trim(),
        _id_front: frontUrl,
        _id_back: backUrl,
        _selfie: selfieDataUrl ?? "",
      });
      if (error) throw error;
      toast.success("KYC submitted for review");
      try {
        const { notify } = await import("@/lib/notify");
        const { data: u } = await supabase.auth.getUser();
        await notify(u.user?.id, "kyc", "KYC submitted for review",
          "We received your identity verification documents and live facial check. Our compliance team will review and notify you once verified.",
          { details: [
            { label: "Full name", value: fullName.trim() },
            { label: "Document type", value: idType.toUpperCase() },
            { label: "Document number", value: idNumber.trim() },
            { label: "Status", value: "Pending review" },
            { label: "Submitted", value: new Date().toLocaleString() },
          ] });
      } catch {}
      setStep("pending");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error(msg);
      setStep("face");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-7 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">Identity Verification (KYC)</h2>
          <p className="text-sm text-muted-foreground">
            To protect your funds, complete a quick one-time verification before your first withdrawal.
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* stepper */}
      <div className="mb-6 flex items-center gap-2 text-xs">
        <StepPill n={1} label="Details" active={step === "form"} done={step !== "form"} />
        <div className="h-px flex-1 bg-border" />
        <StepPill n={2} label="Face scan" active={step === "face"} done={["submitting","pending","approved","rejected"].includes(step)} />
        <div className="h-px flex-1 bg-border" />
        <StepPill n={3} label="Approval" active={["submitting","pending","rejected"].includes(step)} done={step === "approved"} />
      </div>

      {step === "form" && (
        <div className="space-y-4">
          <Field label="Full names (as on document)">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Wanjiku Mwangi"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Document type">
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value as typeof idType)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                {ID_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label={`${idLabel}`}>
              <div className="relative">
                <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="Enter number"
                  className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <UploadCard
              label={`${idLabel} — Front`}
              slot={front}
              onChange={handleUpload("front")}
              onClear={() => clearUpload("front")}
            />
            {idType !== "passport" ? (
              <UploadCard
                label={`${idLabel} — Back`}
                slot={back}
                onChange={handleUpload("back")}
                onClear={() => clearUpload("back")}
              />
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
                Passports only require the bio-data page (front).
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Your documents are encrypted and used only for verification.
            </p>
            <button
              onClick={proceedToFace}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Continue to face scan
            </button>
          </div>
        </div>
      )}

      {(step === "face" || step === "submitting") && (
        <FaceScan
          onDone={(selfie) => { void submitToServer(selfie); }}
          onBack={() => setStep("form")}
          verifying={step === "submitting"}
        />
      )}

      {step === "pending" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <Hourglass className="h-10 w-10 animate-pulse" />
            <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-amber-500/40" />
          </div>
          <div className="text-lg font-semibold">Submitted — awaiting admin approval</div>
          <p className="max-w-md text-sm text-muted-foreground">
            Thank you, {fullName || "trader"}. Your documents are queued for manual review by
            our compliance team. You will be notified as soon as your identity is approved
            (usually within a few minutes). You can safely close this page.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking status…
          </div>
          {onCancel && (
            <button onClick={onCancel} className="mt-4 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted">
              Back
            </button>
          )}
        </div>
      )}

      {step === "approved" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <PartyPopper className="h-10 w-10" />
          </div>
          <div className="text-2xl font-bold">🎉 Congratulations!</div>
          <div className="text-base font-semibold text-emerald-600">Your KYC has been approved</div>
          <p className="max-w-md text-sm text-muted-foreground">
            A verified badge has been added to your profile. You can now withdraw funds and
            unlock the full ZiiDi Trader experience.
          </p>
          <button
            onClick={onVerified}
            className="mt-3 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Continue
          </button>
        </div>
      )}

      {step === "rejected" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <X className="h-9 w-9" />
          </div>
          <div className="text-lg font-semibold">Verification rejected</div>
          <p className="max-w-md text-sm text-muted-foreground">
            {rejectReason || "Your submission was rejected. Please re-upload clear documents and try again."}
          </p>
          <button
            onClick={() => { setStep("form"); }}
            className="mt-3 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Re-submit documents
          </button>
        </div>
      )}
    </div>
  );
}

function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1 ${
        done
          ? "bg-primary/10 text-primary"
          : active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
      }`}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/30 text-[10px] font-bold">
        {done ? <Check className="h-3 w-3" /> : n}
      </span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function UploadCard({
  label,
  slot,
  onChange,
  onClear,
}: {
  label: string;
  slot: UploadSlot;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      {slot.preview ? (
        <div className="group relative overflow-hidden rounded-xl border border-border bg-black">
          <img src={slot.preview} alt={label} className="h-44 w-full object-contain" />
          <button
            onClick={onClear}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
            aria-label="Remove"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            Uploaded
          </div>
        </div>
      ) : (
        <label className="flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-center hover:bg-muted/50">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">Click to upload</span>
          <span className="text-[11px] text-muted-foreground">PNG, JPG · up to 8MB</span>
          <input type="file" accept="image/*" className="hidden" onChange={onChange} />
        </label>
      )}
    </div>
  );
}

function FaceScan({
  onDone,
  onBack,
  verifying,
}: {
  onDone: (selfieDataUrl: string | null) => void;
  onBack: () => void;
  verifying: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "look" | "blink" | "turn" | "capturing">("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Camera access denied";
        setError(msg);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const startLiveness = async () => {
    if (!ready || phase !== "idle") return;
    const prompts: Array<"look" | "blink" | "turn"> = ["look", "blink", "turn"];
    for (const p of prompts) {
      setPhase(p);
      for (let n = 3; n >= 1; n--) {
        setCountdown(n);
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    setCountdown(null);
    setPhase("capturing");
    // capture frame
    let shot: string | null = null;
    const video = videoRef.current;
    if (video) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        shot = canvas.toDataURL("image/jpeg", 0.85);
        setSnapshot(shot);
      }
    }
    await new Promise((r) => setTimeout(r, 500));
    onDone(shot);
  };

  const prompt = phase === "look"
    ? "Look straight at the camera"
    : phase === "blink"
      ? "Blink slowly twice"
      : phase === "turn"
        ? "Slowly turn your head left and right"
        : phase === "capturing"
          ? "Capturing…"
          : "Position your face inside the circle";

  return (
    <div>
      <div className="mb-3 text-center text-sm font-medium">{prompt}</div>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-full border-4 border-primary/40 bg-black">
        {snapshot ? (
          <img src={snapshot} alt="Face snapshot" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}
        {/* scanning ring */}
        {phase !== "idle" && !snapshot && (
          <div className="pointer-events-none absolute inset-0 animate-pulse rounded-full ring-4 ring-primary/60" />
        )}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/60 px-6 py-3 text-4xl font-bold text-white">
              {countdown}
            </div>
          </div>
        )}
        {verifying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin" />
              <div className="text-sm font-semibold">Verifying identity…</div>
            </div>
          </div>
        )}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
          <Camera className="mx-auto mb-1 h-4 w-4" />
          Unable to access camera: {error}. Please allow camera permissions and retry.
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button
          onClick={onBack}
          disabled={verifying}
          className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={startLiveness}
          disabled={!ready || verifying || phase !== "idle"}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          {phase === "idle" ? "Start face scan" : "Scanning…"}
        </button>
      </div>
    </div>
  );
}