import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";
import type { Product } from "@/hooks/useProducts";

export type { Product };

const QK = (studioId?: string) => ["manage", "products", studioId];

export function useManageProducts() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const currency = studioCtx?.studio?.currency ?? "NOK";
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["manage", "products"] });

  const query = useQuery({
    queryKey: QK(studioId),
    enabled: !!studioId,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("studio_id", studioId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const createProduct = useMutation({
    mutationFn: async (values: Omit<Product, "id" | "studio_id" | "currency">) => {
      const { error } = await supabase.from("products").insert({
        ...values,
        studio_id: studioId!,
        currency,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...values }: Partial<Product> & { id: string }) => {
      const { error } = await supabase.from("products").update(values).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("products").update({ is_active }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { ...query, createProduct, updateProduct, toggleActive };
}
