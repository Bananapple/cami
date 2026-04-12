import { useState } from "react";

interface BillingFormProps {
  onSubmit: (data: BillingData) => void;
  initialData?: BillingData;
}

export interface BillingData {
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

const BillingForm = ({ onSubmit, initialData }: BillingFormProps) => {
  const [data, setData] = useState<BillingData>(
    initialData ?? { address: "", city: "", postalCode: "", country: "United States" }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(data);
  };

  const inputClass =
    "w-full bg-transparent border-b border-border pb-2 text-foreground font-serif focus:border-primary focus:outline-none transition-colors placeholder:text-muted-foreground/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-lg font-serif text-foreground">Billing address</h3>

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Address
          </label>
          <input
            type="text"
            value={data.address}
            onChange={(e) => setData({ ...data, address: e.target.value })}
            placeholder="123 Yoga Street"
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            City
          </label>
          <input
            type="text"
            value={data.city}
            onChange={(e) => setData({ ...data, city: e.target.value })}
            placeholder="Seattle"
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Postal Code
          </label>
          <input
            type="text"
            value={data.postalCode}
            onChange={(e) => setData({ ...data, postalCode: e.target.value })}
            placeholder="98101"
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-sans font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Country
          </label>
          <select
            value={data.country}
            onChange={(e) => setData({ ...data, country: e.target.value })}
            className="w-full bg-transparent border-b border-border pb-2 text-foreground font-serif focus:border-primary focus:outline-none transition-colors"
          >
            <option>United States</option>
            <option>Canada</option>
            <option>United Kingdom</option>
            <option>Australia</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-sans">
        We will use your address for invoices only.
      </p>

      <button
        type="submit"
        className="w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3.5 font-sans font-medium text-sm uppercase tracking-[0.15em] rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
      >
        Select Payment Method →
      </button>
    </form>
  );
};

export default BillingForm;
