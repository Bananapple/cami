import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  studio_id: string;
  type: "drop_in" | "clip_card" | "subscription" | "addon" | "private";
  name: string;
  description: string | null;
  image_url: string | null;
  tag: string | null;
  price_minor: number;
  currency: string;
  credits: number | null;
  validity_days: number | null;
  billing_interval: string | null;
  commitment_months: number | null;
  requires_contact: boolean;
  is_active: boolean;
  display_order: number;
};

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setError(new Error(error.message));
        } else {
          setProducts((data ?? []) as Product[]);
        }
        setIsLoading(false);
      });
  }, []);

  return { products, isLoading, error };
}

export function useBuyProduct() {
  return useMutation({
    mutationFn: async (product_id: string) => {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { product_id, return_url: window.location.origin + "/dashboard" },
      });
      if (error || !data?.checkout_url) {
        let message = data?.error ?? "Unable to start checkout. Please try again.";
        if (error?.context) {
          try {
            const body = await error.context.json();
            message = body.error ?? message;
          } catch { /* ignore JSON parse error */ }
        }
        throw new Error(message);
      }
      return data as { checkout_url: string; payment_id: string };
    },
  });
}
