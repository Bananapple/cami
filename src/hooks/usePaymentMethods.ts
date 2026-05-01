import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useStudioContext } from "@/context/StudioContext";

export function usePaymentMethods() {
  const { user } = useAuth();
  const studioCtx = useStudioContext();
  const studioId = studioCtx?.studio?.id;
  const queryClient = useQueryClient();

  const { data: paymentMethods = [], isLoading, error } = useQuery({
    queryKey: ["payment_methods", user?.id, studioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user!.id)
        .eq("studio_id", studioId!)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!studioId,
  });

  const addPaymentMethod = useMutation({
    mutationFn: async (pm: {
      brand: string;
      last4: string;
      expiry_month: number;
      expiry_year: number;
      provider_external_id: string;
      is_default?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("payment_methods")
        .insert({
          user_id: user!.id,
          studio_id: studioId!,
          provider: "stripe",
          provider_external_id: pm.provider_external_id,
          brand: pm.brand,
          last4: pm.last4,
          expiry_month: pm.expiry_month,
          expiry_year: pm.expiry_year,
          is_default: pm.is_default ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment_methods"] }),
  });

  const deletePaymentMethod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment_methods"] }),
  });

  return { paymentMethods, isLoading, error, addPaymentMethod, deletePaymentMethod };
}
