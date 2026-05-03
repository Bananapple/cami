import { useState } from "react";
import { Plus, Pencil, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useManageProducts } from "../hooks/useManageProducts";
import type { Product } from "../hooks/useManageProducts";
import { ProductDrawer } from "../drawers/ProductDrawer";
import { useManageDiscountCodes } from "../hooks/useManageDiscountCodes";
import type { DiscountCode } from "../hooks/useManageDiscountCodes";
import { useManageStudio } from "../hooks/useManageStudio";
import { useClassTemplates } from "../hooks/useClassTemplates";
import type { ClassTemplate } from "../hooks/useClassTemplates";
import { useManageInstructors } from "../hooks/useManageInstructors";
import type { ManagedInstructor } from "../hooks/useManageInstructors";
import { useManageLocations } from "../hooks/useManageLocations";
import type { ManagedLocation } from "../hooks/useManageLocations";

const TYPE_LABEL: Record<string, string> = {
  clip_card: "Clip card",
  subscription: "Subscription",
  drop_in: "Drop-in",
  private: "Private",
};

const EMPTY_CODE = {
  code: "",
  description: "",
  discount_type: "percent" as const,
  discount_value: 10,
  currency: null as string | null,
  valid_until: null as string | null,
  max_redemptions: null as number | null,
};

const EMPTY_TEMPLATE = {
  name: "",
  level: "" as string | null,
  description: "" as string | null,
  image_url: "" as string | null,
  default_duration_minutes: 60,
  default_price: 250,
  default_max_capacity: 20,
};

export function StudioView() {
  const { data: products = [], isLoading, error, toggleActive } = useManageProducts();
  const [drawerProduct, setDrawerProduct] = useState<Product | null | "new">(null);

  const { templates, isLoading: templatesLoading, createTemplate, updateTemplate, toggleActive: toggleTemplate } = useClassTemplates();
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ ...EMPTY_TEMPLATE });
  const [editingTemplate, setEditingTemplate] = useState<ClassTemplate | null>(null);

  const { instructors, isLoading: instructorsLoading, create: createInstructor, update: updateInstructor, toggleActive: toggleInstructor } = useManageInstructors();
  const [addInstructorOpen, setAddInstructorOpen] = useState(false);
  const [newInstructor, setNewInstructor] = useState({ display_name: "", initials: "", specialty: "", bio: "", image_url: "" });
  const [editingInstructor, setEditingInstructor] = useState<ManagedInstructor | null>(null);

  const { locations, isLoading: locationsLoading, create: createLocation, update: updateLocation, toggleActive: toggleLocation } = useManageLocations();
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: "", address: "", timezone: "", default_capacity: 20 });
  const [editingLocation, setEditingLocation] = useState<ManagedLocation | null>(null);

  const {
    data: discountCodes = [],
    isLoading: codesLoading,
    error: codesError,
    createCode,
    toggleActive: toggleCode,
  } = useManageDiscountCodes();

  const { studio, save: saveStudio } = useManageStudio();
  const [referralEnabled, setReferralEnabled] = useState<boolean | null>(null);
  const [referralPct, setReferralPct] = useState<number | null>(null);

  // Sync local state from studio once loaded
  const studioReferralEnabled = (studio as any)?.referral_enabled ?? false;
  const studioReferralPct = (studio as any)?.referral_discount_percent ?? 20;

  const [addCodeOpen, setAddCodeOpen] = useState(false);
  const [newCode, setNewCode] = useState({ ...EMPTY_CODE });

  const handleCreateCode = async () => {
    if (!newCode.code.trim()) { toast.error("Code is required."); return; }
    try {
      await createCode.mutateAsync({
        ...newCode,
        code: newCode.code.trim().toUpperCase(),
        description: newCode.description || null,
        discount_value: Number(newCode.discount_value),
        max_redemptions: newCode.max_redemptions ? Number(newCode.max_redemptions) : null,
      });
      setNewCode({ ...EMPTY_CODE });
      setAddCodeOpen(false);
      toast.success("Discount code created.");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create code.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
      {/* Products section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif">Studio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your products and studio settings.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <h2 className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground">
            Products
          </h2>
          <button
            onClick={() => setDrawerProduct("new")}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add product
          </button>
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        )}

        {error && (
          <p className="text-sm text-destructive py-4">
            Failed to load products. Check that migration 0013 has been applied.
          </p>
        )}

        {!isLoading && !error && products.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No products yet. Add your first one.
          </p>
        )}

        {!isLoading && products.length > 0 && (
          <div className="space-y-2">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onEdit={() => setDrawerProduct(product)}
                onToggle={() => {
                  toggleActive.mutate(
                    { id: product.id, is_active: !product.is_active },
                    {
                      onError: () => toast.error("Failed to update product."),
                    }
                  );
                }}
              />
            ))}
          </div>
        )}
      </section>

      <ProductDrawer
        product={drawerProduct === "new" ? null : drawerProduct}
        open={drawerProduct !== null}
        onOpenChange={(open) => !open && setDrawerProduct(null)}
      />

      {/* Class Types section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <h2 className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground">
              Class Types
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Templates used when scheduling classes. Changes don't affect existing bookings.
            </p>
          </div>
          <button
            onClick={() => { setAddTemplateOpen((o) => !o); setNewTemplate({ ...EMPTY_TEMPLATE }); }}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
          >
            {addTemplateOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {addTemplateOpen ? "Cancel" : "Add class type"}
          </button>
        </div>

        {addTemplateOpen && (
          <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-sans text-muted-foreground">Name *</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate((t) => ({ ...t, name: e.target.value }))}
                  placeholder="e.g. Ashtanga Mysore"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-sans text-muted-foreground">Description</label>
                <textarea
                  value={newTemplate.description ?? ""}
                  onChange={(e) => setNewTemplate((t) => ({ ...t, description: e.target.value || null }))}
                  placeholder="Short description shown on the classes page"
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-sans text-muted-foreground">Image URL</label>
                <input
                  type="url"
                  value={newTemplate.image_url ?? ""}
                  onChange={(e) => setNewTemplate((t) => ({ ...t, image_url: e.target.value || null }))}
                  placeholder="https://…"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Level</label>
                <select
                  value={newTemplate.level ?? ""}
                  onChange={(e) => setNewTemplate((t) => ({ ...t, level: e.target.value || null }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                >
                  <option value="">— Any level —</option>
                  <option value="beginner">Beginner</option>
                  <option value="all levels">All levels</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Duration (min)</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={newTemplate.default_duration_minutes}
                  onChange={(e) => setNewTemplate((t) => ({ ...t, default_duration_minutes: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Default price (kr)</label>
                <input
                  type="number"
                  min="0"
                  value={newTemplate.default_price}
                  onChange={(e) => setNewTemplate((t) => ({ ...t, default_price: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Default capacity</label>
                <input
                  type="number"
                  min="1"
                  value={newTemplate.default_max_capacity}
                  onChange={(e) => setNewTemplate((t) => ({ ...t, default_max_capacity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                />
              </div>
            </div>
            <button
              onClick={async () => {
                if (!newTemplate.name.trim()) { toast.error("Name is required."); return; }
                try {
                  await createTemplate.mutateAsync({
                    name: newTemplate.name.trim(),
                    level: newTemplate.level || null,
                    description: newTemplate.description || null,
                    image_url: newTemplate.image_url || null,
                    default_duration_minutes: newTemplate.default_duration_minutes,
                    default_price: newTemplate.default_price,
                    default_max_capacity: newTemplate.default_max_capacity,
                  });
                  setNewTemplate({ ...EMPTY_TEMPLATE });
                  setAddTemplateOpen(false);
                  toast.success("Class type added.");
                } catch (err: any) {
                  toast.error(err.message ?? "Failed to add class type.");
                }
              }}
              disabled={createTemplate.isPending}
              className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              {createTemplate.isPending ? "Adding…" : "Add class type"}
            </button>
          </div>
        )}

        {templatesLoading && (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        )}

        {!templatesLoading && templates.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No class types yet.</p>
        )}

        {!templatesLoading && templates.length > 0 && (
          <div className="space-y-2">
            {templates.map((tmpl) => (
              editingTemplate?.id === tmpl.id ? (
                <TemplateEditRow
                  key={tmpl.id}
                  template={editingTemplate}
                  onChange={setEditingTemplate}
                  onSave={async () => {
                    try {
                      await updateTemplate.mutateAsync({
                        id: editingTemplate.id,
                        name: editingTemplate.name,
                        level: editingTemplate.level,
                        description: editingTemplate.description,
                        image_url: editingTemplate.image_url,
                        default_duration_minutes: editingTemplate.default_duration_minutes,
                        default_price: editingTemplate.default_price,
                        default_max_capacity: editingTemplate.default_max_capacity,
                      });
                      setEditingTemplate(null);
                      toast.success("Class type updated.");
                    } catch (err: any) {
                      toast.error(err.message ?? "Failed to update.");
                    }
                  }}
                  onCancel={() => setEditingTemplate(null)}
                  isSaving={updateTemplate.isPending}
                />
              ) : (
                <TemplateRow
                  key={tmpl.id}
                  template={tmpl}
                  onEdit={() => setEditingTemplate({ ...tmpl })}
                  onToggle={() =>
                    toggleTemplate.mutate(
                      { id: tmpl.id, is_active: !tmpl.is_active },
                      { onError: () => toast.error("Failed to update.") }
                    )
                  }
                />
              )
            ))}
          </div>
        )}
      </section>

      {/* Instructors section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <h2 className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground">
              Instructors
            </h2>
          </div>
          <button
            onClick={() => { setAddInstructorOpen((o) => !o); setNewInstructor({ display_name: "", initials: "", bio: "", image_url: "" }); }}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
          >
            {addInstructorOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {addInstructorOpen ? "Cancel" : "Add instructor"}
          </button>
        </div>

        {addInstructorOpen && (
          <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Name *</label>
                <input type="text" value={newInstructor.display_name}
                  onChange={(e) => setNewInstructor((i) => ({ ...i, display_name: e.target.value }))}
                  placeholder="e.g. Brinkela Gjokaj"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Initials *</label>
                <input type="text" value={newInstructor.initials} maxLength={4}
                  onChange={(e) => setNewInstructor((i) => ({ ...i, initials: e.target.value.toUpperCase() }))}
                  placeholder="BG"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md uppercase" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-sans text-muted-foreground">Specialty</label>
                <input type="text" value={newInstructor.specialty}
                  onChange={(e) => setNewInstructor((i) => ({ ...i, specialty: e.target.value }))}
                  placeholder="e.g. Ashtanga Yoga & Pilates"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-sans text-muted-foreground">Bio</label>
                <textarea value={newInstructor.bio}
                  onChange={(e) => setNewInstructor((i) => ({ ...i, bio: e.target.value }))}
                  rows={2} placeholder="Short bio shown on the Coaches page"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-sans text-muted-foreground">Photo URL</label>
                <input type="url" value={newInstructor.image_url}
                  onChange={(e) => setNewInstructor((i) => ({ ...i, image_url: e.target.value }))}
                  placeholder="https://…"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md" />
              </div>
            </div>
            <button
              onClick={async () => {
                if (!newInstructor.display_name.trim() || !newInstructor.initials.trim()) {
                  toast.error("Name and initials are required."); return;
                }
                try {
                  await createInstructor.mutateAsync({
                    display_name: newInstructor.display_name.trim(),
                    initials: newInstructor.initials.trim(),
                    specialty: newInstructor.specialty || null,
                    bio: newInstructor.bio || null,
                    image_url: newInstructor.image_url || null,
                  });
                  setAddInstructorOpen(false);
                  toast.success("Instructor added.");
                } catch (err: any) { toast.error(err.message ?? "Failed to add instructor."); }
              }}
              disabled={createInstructor.isPending}
              className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              {createInstructor.isPending ? "Adding…" : "Add instructor"}
            </button>
          </div>
        )}

        {instructorsLoading && <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>}
        {!instructorsLoading && instructors.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No instructors yet.</p>
        )}
        {!instructorsLoading && instructors.length > 0 && (
          <div className="space-y-2">
            {instructors.map((inst) =>
              editingInstructor?.id === inst.id ? (
                <InlineEditRow key={inst.id}
                  fields={[
                    { label: "Name", value: editingInstructor.display_name, onChange: (v) => setEditingInstructor((i) => i && ({ ...i, display_name: v })) },
                    { label: "Initials", value: editingInstructor.initials, onChange: (v) => setEditingInstructor((i) => i && ({ ...i, initials: v.toUpperCase() })), maxLength: 4 },
                    { label: "Specialty", value: editingInstructor.specialty ?? "", onChange: (v) => setEditingInstructor((i) => i && ({ ...i, specialty: v || null })) },
                    { label: "Bio", value: editingInstructor.bio ?? "", onChange: (v) => setEditingInstructor((i) => i && ({ ...i, bio: v || null })), multiline: true },
                    { label: "Photo URL", value: editingInstructor.image_url ?? "", onChange: (v) => setEditingInstructor((i) => i && ({ ...i, image_url: v || null })) },
                  ]}
                  onSave={async () => {
                    try {
                      await updateInstructor.mutateAsync({ id: editingInstructor.id, display_name: editingInstructor.display_name, initials: editingInstructor.initials, specialty: editingInstructor.specialty, bio: editingInstructor.bio, image_url: editingInstructor.image_url });
                      setEditingInstructor(null);
                      toast.success("Instructor updated.");
                    } catch (err: any) { toast.error(err.message ?? "Failed to update."); }
                  }}
                  onCancel={() => setEditingInstructor(null)}
                  isSaving={updateInstructor.isPending}
                />
              ) : (
                <PersonRow key={inst.id} name={inst.display_name} meta={inst.specialty ?? inst.initials} isActive={inst.is_active}
                  onEdit={() => setEditingInstructor({ ...inst })}
                  onToggle={() => toggleInstructor.mutate({ id: inst.id, is_active: !inst.is_active }, { onError: () => toast.error("Failed to update.") })}
                />
              )
            )}
          </div>
        )}
      </section>

      {/* Locations section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <h2 className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground">
              Locations
            </h2>
          </div>
          <button
            onClick={() => { setAddLocationOpen((o) => !o); setNewLocation({ name: "", address: "", timezone: "", default_capacity: 20 }); }}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
          >
            {addLocationOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {addLocationOpen ? "Cancel" : "Add location"}
          </button>
        </div>

        {addLocationOpen && (
          <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-sans text-muted-foreground">Name *</label>
                <input type="text" value={newLocation.name}
                  onChange={(e) => setNewLocation((l) => ({ ...l, name: e.target.value }))}
                  placeholder="e.g. Main Studio"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-sans text-muted-foreground">Address</label>
                <input type="text" value={newLocation.address}
                  onChange={(e) => setNewLocation((l) => ({ ...l, address: e.target.value }))}
                  placeholder="Street address"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Timezone</label>
                <input type="text" value={newLocation.timezone}
                  onChange={(e) => setNewLocation((l) => ({ ...l, timezone: e.target.value }))}
                  placeholder="Leave blank to use studio default"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Default capacity</label>
                <input type="number" min={1} value={newLocation.default_capacity}
                  onChange={(e) => setNewLocation((l) => ({ ...l, default_capacity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md" />
              </div>
            </div>
            <button
              onClick={async () => {
                if (!newLocation.name.trim()) { toast.error("Name is required."); return; }
                try {
                  await createLocation.mutateAsync({
                    name: newLocation.name.trim(),
                    address: newLocation.address || null,
                    timezone: newLocation.timezone || null,
                    default_capacity: newLocation.default_capacity,
                  });
                  setAddLocationOpen(false);
                  toast.success("Location added.");
                } catch (err: any) { toast.error(err.message ?? "Failed to add location."); }
              }}
              disabled={createLocation.isPending}
              className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              {createLocation.isPending ? "Adding…" : "Add location"}
            </button>
          </div>
        )}

        {locationsLoading && <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>}
        {!locationsLoading && locations.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No locations yet.</p>
        )}
        {!locationsLoading && locations.length > 0 && (
          <div className="space-y-2">
            {locations.map((loc) =>
              editingLocation?.id === loc.id ? (
                <InlineEditRow key={loc.id}
                  fields={[
                    { label: "Name", value: editingLocation.name, onChange: (v) => setEditingLocation((l) => l && ({ ...l, name: v })) },
                    { label: "Address", value: editingLocation.address ?? "", onChange: (v) => setEditingLocation((l) => l && ({ ...l, address: v || null })) },
                    { label: "Timezone", value: editingLocation.timezone ?? "", onChange: (v) => setEditingLocation((l) => l && ({ ...l, timezone: v || null })), placeholder: "Leave blank for studio default" },
                    { label: "Default capacity", value: String(editingLocation.default_capacity), onChange: (v) => setEditingLocation((l) => l && ({ ...l, default_capacity: Number(v) || 20 })), type: "number" },
                  ]}
                  onSave={async () => {
                    try {
                      await updateLocation.mutateAsync({ id: editingLocation.id, name: editingLocation.name, address: editingLocation.address, timezone: editingLocation.timezone, default_capacity: editingLocation.default_capacity });
                      setEditingLocation(null);
                      toast.success("Location updated.");
                    } catch (err: any) { toast.error(err.message ?? "Failed to update."); }
                  }}
                  onCancel={() => setEditingLocation(null)}
                  isSaving={updateLocation.isPending}
                />
              ) : (
                <PersonRow key={loc.id} name={loc.name} meta={loc.address ?? (loc.timezone ?? "Studio timezone")} isActive={loc.is_active}
                  onEdit={() => setEditingLocation({ ...loc })}
                  onToggle={() => toggleLocation.mutate({ id: loc.id, is_active: !loc.is_active }, { onError: () => toast.error("Failed to update.") })}
                />
              )
            )}
          </div>
        )}
      </section>

      {/* Referral Program section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <h2 className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground">
              Referral Program
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Members share their personal link. New customers get a % off their first drop-in class.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-4">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-sans text-foreground">Enable referral program</p>
              <p className="text-xs text-muted-foreground mt-0.5">Members can share links; new customers get a discount on their first class</p>
            </div>
            <button
              onClick={() => {
                const next = !(referralEnabled ?? studioReferralEnabled);
                setReferralEnabled(next);
                saveStudio.mutate({ referral_enabled: next }, {
                  onError: () => {
                    setReferralEnabled(null);
                    toast.error("Failed to save.");
                  },
                });
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                (referralEnabled ?? studioReferralEnabled) ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  (referralEnabled ?? studioReferralEnabled) ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Discount % */}
          {(referralEnabled ?? studioReferralEnabled) && (
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <div className="flex-1">
                <p className="text-sm font-sans text-foreground">Discount for new customer</p>
                <p className="text-xs text-muted-foreground mt-0.5">Applied to their first drop-in booking only</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={referralPct ?? studioReferralPct}
                  onChange={(e) => setReferralPct(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 text-sm text-center bg-background border border-border rounded-md"
                />
                <span className="text-sm text-muted-foreground">%</span>
                {referralPct !== null && referralPct !== studioReferralPct && (
                  <button
                    onClick={() => {
                      saveStudio.mutate({ referral_discount_percent: referralPct }, {
                        onSuccess: () => setReferralPct(null),
                        onError: () => toast.error("Failed to save."),
                      });
                    }}
                    disabled={saveStudio.isPending}
                    className="text-xs px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Discount codes section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-t border-border pt-4">
          <h2 className="text-sm font-sans font-medium uppercase tracking-wider text-muted-foreground">
            Discount Codes
          </h2>
          <button
            onClick={() => setAddCodeOpen((o) => !o)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
          >
            {addCodeOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {addCodeOpen ? "Cancel" : "Add code"}
          </button>
        </div>

        {addCodeOpen && (
          <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Code *</label>
                <input
                  type="text"
                  value={newCode.code}
                  onChange={(e) => setNewCode((c) => ({ ...c, code: e.target.value.toUpperCase() }))}
                  placeholder="SUMMER20"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md uppercase tracking-widest placeholder:normal-case"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Description</label>
                <input
                  type="text"
                  value={newCode.description ?? ""}
                  onChange={(e) => setNewCode((c) => ({ ...c, description: e.target.value }))}
                  placeholder="Summer promo"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Type</label>
                <select
                  value={newCode.discount_type}
                  onChange={(e) => setNewCode((c) => ({ ...c, discount_type: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                >
                  <option value="percent">% off</option>
                  <option value="fixed_off">Fixed (NOK)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">
                  {newCode.discount_type === "percent" ? "Percent" : "Amount (NOK)"}
                </label>
                <input
                  type="number"
                  min="1"
                  max={newCode.discount_type === "percent" ? "99" : undefined}
                  value={newCode.discount_value}
                  onChange={(e) => setNewCode((c) => ({ ...c, discount_value: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-sans text-muted-foreground">Max uses</label>
                <input
                  type="number"
                  min="1"
                  value={newCode.max_redemptions ?? ""}
                  onChange={(e) => setNewCode((c) => ({ ...c, max_redemptions: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-sans text-muted-foreground">Expires</label>
              <select
                value={newCode.valid_until ?? "never"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "never") { setNewCode((c) => ({ ...c, valid_until: null })); return; }
                  const months = Number(v);
                  const d = new Date();
                  d.setMonth(d.getMonth() + months);
                  setNewCode((c) => ({ ...c, valid_until: d.toISOString() }));
                }}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
              >
                <option value="never">Never</option>
                <option value="1">1 month</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">1 year</option>
              </select>
            </div>
            <button
              onClick={handleCreateCode}
              disabled={createCode.isPending}
              className="w-full py-2 text-sm font-sans bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              {createCode.isPending ? "Creating…" : "Create Code"}
            </button>
          </div>
        )}

        {codesLoading && (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        )}

        {codesError && (
          <p className="text-sm text-destructive py-4">
            Failed to load discount codes. Check that migration 0012 has been applied.
          </p>
        )}

        {!codesLoading && !codesError && discountCodes.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No discount codes yet.
          </p>
        )}

        {!codesLoading && discountCodes.length > 0 && (
          <div className="space-y-2">
            {discountCodes.map((code) => (
              <DiscountCodeRow
                key={code.id}
                code={code}
                onToggle={() =>
                  toggleCode.mutate(
                    { id: code.id, is_active: !code.is_active },
                    { onError: () => toast.error("Failed to update code.") }
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TemplateRow({
  template,
  onEdit,
  onToggle,
}: {
  template: ClassTemplate;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const meta = [
    template.level ?? "All levels",
    `${template.default_duration_minutes} min`,
    `${template.default_max_capacity} spots`,
    `kr ${template.default_price}`,
  ].join(" · ");

  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border border-border transition-opacity ${template.is_active ? "" : "opacity-50"}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-serif">{template.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
      </div>
      <button
        onClick={onToggle}
        className={`text-xs px-2.5 py-1 rounded-full font-sans transition-colors shrink-0 ${
          template.is_active
            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        {template.is_active ? "Active" : "Inactive"}
      </button>
      <button
        onClick={onEdit}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Edit"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function TemplateEditRow({
  template,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: {
  template: ClassTemplate;
  onChange: (t: ClassTemplate) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="rounded-lg border border-primary/40 p-4 space-y-3 bg-muted/20">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <label className="text-xs font-sans text-muted-foreground">Name</label>
          <input
            type="text"
            value={template.name}
            onChange={(e) => onChange({ ...template, name: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-xs font-sans text-muted-foreground">Description</label>
          <textarea
            value={template.description ?? ""}
            onChange={(e) => onChange({ ...template, description: e.target.value || null })}
            rows={2}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none"
          />
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-xs font-sans text-muted-foreground">Image URL</label>
          <input
            type="url"
            value={template.image_url ?? ""}
            onChange={(e) => onChange({ ...template, image_url: e.target.value || null })}
            placeholder="https://…"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-sans text-muted-foreground">Level</label>
          <select
            value={template.level ?? ""}
            onChange={(e) => onChange({ ...template, level: e.target.value || null })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          >
            <option value="">— Any level —</option>
            <option value="beginner">Beginner</option>
            <option value="all levels">All levels</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-sans text-muted-foreground">Duration (min)</label>
          <input
            type="number"
            min="5"
            value={template.default_duration_minutes}
            onChange={(e) => onChange({ ...template, default_duration_minutes: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-sans text-muted-foreground">Default price (kr)</label>
          <input
            type="number"
            min="0"
            value={template.default_price}
            onChange={(e) => onChange({ ...template, default_price: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-sans text-muted-foreground">Default capacity</label>
          <input
            type="number"
            min="1"
            value={template.default_max_capacity}
            onChange={(e) => onChange({ ...template, default_max_capacity: Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function DiscountCodeRow({ code, onToggle }: { code: DiscountCode; onToggle: () => void }) {
  const discountLabel =
    code.discount_type === "percent"
      ? `${code.discount_value}% off`
      : `NOK ${code.discount_value} off`;

  const meta = [
    discountLabel,
    code.times_redeemed ? `${code.times_redeemed} uses` : "0 uses",
    code.max_redemptions ? `max ${code.max_redemptions}` : null,
    code.valid_until
      ? `expires ${new Date(code.valid_until).toLocaleDateString("nb-NO")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border border-border transition-opacity ${
        code.is_active ? "" : "opacity-50"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono text-foreground tracking-widest">{code.code}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
      </div>
      {code.description && (
        <p className="text-xs text-muted-foreground font-sans hidden sm:block shrink-0 max-w-[160px] truncate">
          {code.description}
        </p>
      )}
      <button
        onClick={onToggle}
        className={`text-xs px-2.5 py-1 rounded-full font-sans transition-colors shrink-0 ${
          code.is_active
            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        {code.is_active ? "Active" : "Inactive"}
      </button>
    </div>
  );
}

function ProductRow({
  product,
  onEdit,
  onToggle,
}: {
  product: Product;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const priceNOK = (product.price_minor / 100).toLocaleString("nb-NO");
  const currency = product.currency ?? "NOK";

  const meta = [
    TYPE_LABEL[product.type] ?? product.type,
    product.credits ? `${product.credits} credits` : null,
    product.validity_days ? `${product.validity_days} days` : null,
    product.billing_interval === "month" ? "monthly" : null,
    product.commitment_months ? `${product.commitment_months}-month commitment` : null,
    product.requires_contact ? "contact only" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border border-border transition-opacity ${
        product.is_active ? "" : "opacity-50"
      }`}
    >
      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-serif truncate">{product.name}</p>
          {product.tag && (
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-sans uppercase tracking-wide">
              {product.tag}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
      </div>

      {/* Price */}
      <p className="text-sm font-serif shrink-0">
        {currency} {priceNOK}
        {product.billing_interval === "month" ? "/mo" : ""}
      </p>

      {/* Active toggle */}
      <button
        onClick={onToggle}
        className={`text-xs px-2.5 py-1 rounded-full font-sans transition-colors shrink-0 ${
          product.is_active
            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        {product.is_active ? "Active" : "Inactive"}
      </button>

      {/* Edit */}
      <button
        onClick={onEdit}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Edit product"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function PersonRow({ name, meta, isActive, onEdit, onToggle }: {
  name: string; meta: string; isActive: boolean; onEdit: () => void; onToggle: () => void;
}) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border border-border transition-opacity ${isActive ? "" : "opacity-50"}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-serif">{name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
      </div>
      <button onClick={onToggle}
        className={`text-xs px-2.5 py-1 rounded-full font-sans transition-colors shrink-0 ${isActive ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
        {isActive ? "Active" : "Inactive"}
      </button>
      <button onClick={onEdit} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0">
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

type FieldDef = { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; maxLength?: number; placeholder?: string; type?: string };

function InlineEditRow({ fields, onSave, onCancel, isSaving }: {
  fields: FieldDef[]; onSave: () => void; onCancel: () => void; isSaving: boolean;
}) {
  return (
    <div className="rounded-lg border border-primary/40 p-4 space-y-3 bg-muted/20">
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.label} className="space-y-1 col-span-2">
            <label className="text-xs font-sans text-muted-foreground">{f.label}</label>
            {f.multiline ? (
              <textarea value={f.value} onChange={(e) => f.onChange(e.target.value)} rows={2}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none" />
            ) : (
              <input type={f.type ?? "text"} value={f.value} onChange={(e) => f.onChange(e.target.value)}
                maxLength={f.maxLength} placeholder={f.placeholder}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md" />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button onClick={onSave} disabled={isSaving} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 transition-colors">
          <Check className="w-3.5 h-3.5" /> {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
