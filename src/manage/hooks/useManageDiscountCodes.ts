import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudioContext } from "@/context/StudioContext";

export interface DiscountCode {
  id: string;
  studio_id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed_off";
  discount_value: number;
  currency: string | null;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
  is_active: boolean;
  created_at: string;
}

export type NewDiscountCode = Pick<
  DiscountCode,
  "code" | "description" | "discount_type" | "discount_value" | "currency" | "valid_until" | "max_redemptions"
>;

export function useManageDiscountCodes() {
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["manage", "discount_codes"] });

  const query = useQuery({
    queryKey: ["manage", "discount_codes", studioId],
    enabled: !!studioId,
    queryFn: async (): Promise<DiscountCode[]> => {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("studio_id", studioId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DiscountCode[];
    },
  });

  const createCode = useMutation({
    mutationFn: async (values: NewDiscountCode) => {
      const { error } = await supabase.from("discount_codes").insert({
        ...values,
        studio_id: studioId!,
        is_active: true,
        times_redeemed: 0,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("discount_codes").update({ is_active }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const updateCode = useMutation({
    mutationFn: async ({ id, ...values }: Partial<NewDiscountCode> & { id: string }) => {
      const { error } = await supabase.from("discount_codes").update(values).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { ...query, createCode, toggleActive, updateCode };
}
