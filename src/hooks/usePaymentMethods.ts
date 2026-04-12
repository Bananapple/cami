import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function usePaymentMethods() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: paymentMethods = [], isLoading } = useQuery({
    queryKey: ["payment_methods", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addPaymentMethod = useMutation({
    mutationFn: async (pm: {
      brand: string;
      last4: string;
      expiry_month: number;
      expiry_year: number;
      stripe_payment_method_id?: string;
      is_default?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("payment_methods")
        .insert({ ...pm, user_id: user!.id })
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

  return { paymentMethods, isLoading, addPaymentMethod, deletePaymentMethod };
}
