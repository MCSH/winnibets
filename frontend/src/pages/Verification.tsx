import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  verifyID,
  getVerificationStatus,
  type IDVerificationResult,
  type VerificationStatus,
} from "@/lib/api";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Card, CardContent } from "@/components/ui/card";
import {
  Check,
  X,
  Camera,
  Upload,
  ShieldCheck,
  Loader2,
} from "lucide-react";

type DocType = "passport" | "drivers_license";

export default function Verification() {
  const [docType, setDocType] = useState<DocType>("passport");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<IDVerificationResult | null>(null);
  const [currentStatus, setCurrentStatus] = useState<VerificationStatus | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getVerificationStatus()
      .then(setCurrentStatus)
      .catch(() => {});
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setError("");
    setLoading(true);

    try {
      const res = await verifyID(file, docType, name.trim());
      setResult(res);
      setCurrentStatus(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "verified")
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-win/15 text-win">
          <Check className="size-3" /> Verified
        </span>
      );
    if (status === "failed")
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-lose/15 text-lose">
          <X className="size-3" /> Failed
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-ink-lighter text-chalk-dim">
        Not verified
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-chalk">
          VERIFY ID
        </h1>
        <p className="text-chalk-dim text-sm mt-1">
          Upload a passport or driver's license to verify your identity.
        </p>
      </div>

      {/* Current status */}
      {currentStatus && currentStatus.status !== "none" && !result && (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-chalk">
                Current Status
              </span>
              {statusBadge(currentStatus.status)}
            </div>
            {currentStatus.provided_name && (
              <p className="text-xs text-chalk-dim">
                Name: {currentStatus.provided_name}
              </p>
            )}
            {currentStatus.created_at && (
              <p className="text-xs text-ink-muted">
                {new Date(currentStatus.created_at).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <ToggleGroup
                value={docType}
                onValueChange={setDocType}
                options={[
                  { value: "passport", label: "Passport" },
                  { value: "drivers_license", label: "Driver's License" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name-input">Full Name (as on document)</Label>
              <input
                id="name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="flex h-10 w-full rounded-lg border border-ink-border bg-ink px-3 py-2 text-sm text-chalk placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="space-y-2">
              <Label>Document Photo</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleFile}
                className="hidden"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-4 mr-1.5" />
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (fileRef.current) {
                      fileRef.current.capture = "environment";
                      fileRef.current.click();
                    }
                  }}
                >
                  <Camera className="size-4 mr-1.5" />
                  Camera
                </Button>
              </div>

              <AnimatePresence>
                {preview && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-3"
                  >
                    <img
                      src={preview}
                      alt="Document preview"
                      className="max-h-48 rounded-lg border border-ink-border object-contain"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-ink-muted uppercase tracking-widest">
                <ShieldCheck className="size-3 inline mr-1" />
                Vision AI Verification
              </span>
              <Button
                type="submit"
                disabled={loading || !file || !name.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-lose text-xs font-medium"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </form>
        </CardContent>
      </Card>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card
              className={
                result.status === "verified"
                  ? "border-win/30"
                  : "border-lose/30"
              }
            >
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-chalk">
                    Verification Result
                  </span>
                  {statusBadge(result.status)}
                </div>

                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-ink-muted text-xs uppercase tracking-wider mb-1">
                      Provided Name
                    </p>
                    <p className="text-chalk">{result.provided_name}</p>
                  </div>
                  <div>
                    <p className="text-ink-muted text-xs uppercase tracking-wider mb-1">
                      Extracted Name
                    </p>
                    <p className="text-chalk">
                      {result.extracted_name ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-muted text-xs uppercase tracking-wider mb-1">
                      Name Match
                    </p>
                    <p className={result.name_match ? "text-win" : "text-lose"}>
                      {result.name_match ? "Yes" : "No"}
                    </p>
                  </div>
                  {result.mrz_valid !== null &&
                    result.mrz_valid !== undefined && (
                      <div>
                        <p className="text-ink-muted text-xs uppercase tracking-wider mb-1">
                          MRZ Valid
                        </p>
                        <p
                          className={
                            result.mrz_valid ? "text-win" : "text-lose"
                          }
                        >
                          {result.mrz_valid ? "Yes" : "No"}
                        </p>
                      </div>
                    )}
                </div>

                {result.failure_reason && (
                  <div className="bg-lose/10 border border-lose/20 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-lose">
                      {result.failure_reason}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
