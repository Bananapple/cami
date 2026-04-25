import { useState } from "react";
import { useProfile } from "@/hooks/useProfile";

interface ProfileFormProps {
  onSuccess: () => void;
}

const ProfileForm = ({ onSuccess }: ProfileFormProps) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { updateProfile } = useProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName) return;
    setError(null);

    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const avatarInitials = [firstName[0], lastName[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase();

    try {
      await updateProfile.mutateAsync({
        full_name: fullName,
        avatar_initials: avatarInitials,
        phone_number: phone || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message ?? "Could not save your details. Please try again.");
    }
  };

  const inputClass =
    "w-full bg-transparent border-b border-border pb-2 text-foreground font-serif focus:border-primary focus:outline-none transition-colors placeholder:text-muted-foreground/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-serif text-foreground">Your details</h3>
        <p className="text-sm text-muted-foreground font-sans mt-1">
          Just once — we'll remember you for next time.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            First name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Astrid"
            className={inputClass}
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Last name
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Hansen"
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Phone <span className="normal-case font-normal">(optional)</span>
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+47 900 00 000"
          className={inputClass}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive font-sans">{error}</p>
      )}

      <button
        type="submit"
        disabled={updateProfile.isPending || !firstName}
        className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200 disabled:opacity-50"
      >
        {updateProfile.isPending ? "Saving…" : "Continue →"}
      </button>
    </form>
  );
};

export default ProfileForm;
