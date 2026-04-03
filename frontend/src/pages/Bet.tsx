import { useState, useEffect } from "react";
import { createBet, listContacts, type Contact } from "@/lib/api";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { PhoneField } from "@/components/ui/phone-input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Check,
  Eye,
  EyeOff,
  UserCircle,
} from "lucide-react";

interface BetResult {
  bet_id: number;
  message: string;
}

type CounterpartyMode = "phone" | "email";
type Visibility = "visible" | "hidden";

const STEPS = [
  {
    title: "What's the Bet?",
    description: "Write it out — make it clear, no take-backs",
  },
  { title: "Who's In?", description: "Pick your opponent" },
  { title: "Lock It In", description: "Choose your settings and send it" },
] as const;

export default function Bet() {
  const [step, setStep] = useState(0);
  const [terms, setTerms] = useState("");
  const [amount, setAmount] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [counterpartyMode, setCounterpartyMode] =
    useState<CounterpartyMode>("phone");
  const [visibility, setVisibility] = useState<Visibility>("visible");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BetResult | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  useEffect(() => {
    listContacts()
      .then(setContacts)
      .catch(() => {});
  }, []);

  const canAdvance = () => {
    if (step === 0) return terms.trim().length > 0;
    if (step === 1) return counterparty.trim().length > 0;
    return true;
  };

  const validateAndAdvance = () => {
    setError("");
    if (step === 1 && counterpartyMode === "phone") {
      const cleaned = counterparty.trim();
      if (!cleaned.startsWith("+")) {
        const digits = cleaned.replace(/\D/g, "");
        if (
          !(digits.length === 10) &&
          !(digits.length === 11 && digits.startsWith("1"))
        ) {
          setError("Enter a valid 10-digit phone number");
          return;
        }
      }
    }
    if (step === 1 && counterpartyMode === "email") {
      const cleaned = counterparty.trim();
      if (!cleaned.includes("@") || cleaned.length < 5) {
        setError("Enter a valid email address");
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    setError("");

    let cleaned = counterparty.trim();

    if (counterpartyMode === "phone") {
      if (!cleaned.startsWith("+")) {
        const digits = cleaned.replace(/\D/g, "");
        if (digits.length === 10) {
          cleaned = `+1${digits}`;
        } else if (digits.length === 11 && digits.startsWith("1")) {
          cleaned = `+${digits}`;
        } else {
          setError("Enter a valid 10-digit phone number");
          return;
        }
      }
    }

    setLoading(true);
    try {
      const res = await createBet({
        bet_terms: terms,
        counterparty_identifier: cleaned,
        counterparty_identifier_type: counterpartyMode,
        visibility,
        amount: amount.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(0);
    setTerms("");
    setAmount("");
    setCounterparty("");
    setSelectedContact(null);
    setVisibility("visible");
    setResult(null);
    setError("");
  };

  // Success state
  if (result) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-chalk">
            PLACE A BET
          </h1>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <Card className="border-accent/30">
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 15,
                    delay: 0.2,
                  }}
                  className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center"
                >
                  <Check className="size-5 text-accent" />
                </motion.div>
                <div>
                  <p className="text-sm font-semibold text-accent">
                    Invitation Sent
                  </p>
                  <p className="text-xs text-chalk-dim">Bet #{result.bet_id}</p>
                </div>
              </div>
              <p className="text-sm text-chalk">{result.message}</p>
              <p className="text-xs text-ink-muted">
                Once they accept, it&apos;s locked on the chain forever.
              </p>
              <Button variant="outline" size="sm" onClick={resetForm}>
                Bet Again
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl tracking-wide text-chalk">
          PLACE A BET
        </h1>
        <p className="text-chalk-dim text-sm mt-1">
          Challenge someone. Set the terms. Let the chain settle it.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 shrink-0 ${
                i < step
                  ? "bg-accent text-white cursor-pointer"
                  : i === step
                    ? "bg-accent/20 text-accent border border-accent/50"
                    : "bg-ink-lighter text-ink-muted border border-ink-border cursor-default"
              }`}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </button>
            <span
              className={`text-xs font-medium hidden sm:block transition-colors ${
                i === step ? "text-chalk" : "text-ink-muted"
              }`}
            >
              {s.title}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px transition-colors ${
                  i < step ? "bg-accent/40" : "bg-ink-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>{STEPS[step].title}</CardTitle>
              <CardDescription>{STEPS[step].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Step 0: Terms */}
              {step === 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bet Terms</Label>
                    <Textarea
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      rows={4}
                      placeholder="I bet that..."
                      autoFocus
                    />
                    <p className="text-[11px] text-ink-muted">
                      Be specific — this goes on the blockchain.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Amount{" "}
                      <span className="text-ink-muted font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. $20, dinner, bragging rights"
                    />
                  </div>
                </div>
              )}

              {/* Step 1: Counterparty */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Contact picker */}
                  {contacts.length > 0 && (
                    <div className="space-y-2">
                      <Label>Choose a contact</Label>
                      <div className="flex flex-wrap gap-2">
                        {contacts.map((c) => {
                          const isSelected = selectedContact?.id === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedContact(null);
                                  setCounterparty("");
                                  setCounterpartyMode("phone");
                                } else {
                                  setSelectedContact(c);
                                  setCounterparty(c.identifier);
                                  setCounterpartyMode(
                                    c.identifier_type as CounterpartyMode,
                                  );
                                  setError("");
                                }
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                                isSelected
                                  ? "bg-accent/15 border-accent/50 text-accent"
                                  : "bg-ink border-ink-border/60 text-chalk-dim hover:border-ink-muted hover:text-chalk"
                              }`}
                            >
                              <UserCircle className="size-3.5" />
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Divider when contacts exist */}
                  {contacts.length > 0 && !selectedContact && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-ink-border/30" />
                      <span className="text-[10px] text-ink-muted uppercase tracking-wider">
                        or enter manually
                      </span>
                      <div className="flex-1 h-px bg-ink-border/30" />
                    </div>
                  )}

                  {/* Manual entry (hidden when contact is selected) */}
                  {!selectedContact && (
                    <>
                      <div className="space-y-2">
                        <Label>Contact Method</Label>
                        <ToggleGroup
                          value={counterpartyMode}
                          onValueChange={(m) => {
                            setCounterpartyMode(m);
                            setCounterparty("");
                            setError("");
                          }}
                          options={[
                            { value: "phone", label: "Phone" },
                            { value: "email", label: "Email" },
                          ]}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          {counterpartyMode === "phone"
                            ? "Phone Number"
                            : "Email Address"}
                        </Label>
                        {counterpartyMode === "phone" ? (
                          <PhoneField
                            value={counterparty}
                            onChange={setCounterparty}
                            autoFocus
                          />
                        ) : (
                          <Input
                            type="email"
                            value={counterparty}
                            onChange={(e) => setCounterparty(e.target.value)}
                            placeholder="them@example.com"
                            autoFocus
                          />
                        )}
                        <p className="text-[11px] text-ink-muted">
                          They&apos;ll receive{" "}
                          {counterpartyMode === "phone" ? "an SMS" : "an email"}{" "}
                          with a link to accept or decline.
                        </p>
                      </div>
                    </>
                  )}

                  {/* Selected contact info */}
                  {selectedContact && (
                    <div className="bg-ink/40 border border-accent/20 rounded-lg p-3 flex items-center gap-3">
                      <UserCircle className="size-5 text-accent shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-chalk">
                          {selectedContact.name}
                        </p>
                        <p className="font-mono text-[11px] text-ink-muted truncate">
                          {selectedContact.identifier}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Options & Confirm */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Terms Visibility</Label>
                    <ToggleGroup
                      value={visibility}
                      onValueChange={setVisibility}
                      options={[
                        { value: "visible", label: "Visible" },
                        { value: "hidden", label: "Hidden" },
                      ]}
                    />
                    <div className="flex items-start gap-2 text-[11px] text-ink-muted">
                      {visibility === "visible" ? (
                        <>
                          <Eye className="size-3.5 mt-0.5 shrink-0 text-accent-dim" />
                          <span>
                            Bet terms will be stored in plaintext on the
                            blockchain. Anyone browsing the chain can read them.
                          </span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="size-3.5 mt-0.5 shrink-0 text-accent-dim" />
                          <span>
                            Only a cryptographic hash of the terms is stored
                            on-chain. The actual terms are private between you
                            and your counterparty.
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-ink/40 border border-ink-border/30 rounded-lg p-4 space-y-2">
                    <p className="text-xs font-medium text-chalk-dim uppercase tracking-wider">
                      Summary
                    </p>
                    <p className="text-sm text-chalk line-clamp-2">
                      &ldquo;{terms}&rdquo;
                    </p>
                    <p className="text-xs text-ink-muted">
                      Sending to{" "}
                      <span className="font-mono text-chalk-dim">
                        {selectedContact
                          ? `${selectedContact.name} (${selectedContact.identifier})`
                          : counterparty}
                      </span>{" "}
                      {amount.trim() && (
                        <>
                          &middot;{" "}
                          <span className="text-accent font-medium">
                            {amount.trim()}
                          </span>{" "}
                        </>
                      )}
                      &middot; {visibility} terms · expires in 72h
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
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

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                {step > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep(step - 1);
                      setError("");
                    }}
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>
                ) : (
                  <span className="text-[10px] font-mono text-ink-muted uppercase tracking-widest">
                    Two-party agreement
                  </span>
                )}

                {step < 2 ? (
                  <Button onClick={validateAndAdvance} disabled={!canAdvance()}>
                    Next
                    <ArrowRight className="size-3.5" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={loading}>
                    {loading ? (
                      "Sending..."
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        Send Bet
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
