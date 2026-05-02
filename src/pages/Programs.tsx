import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookingSheet from "@/components/BookingSheet";
import { usePublicClasses, formatSchedule } from "@/hooks/usePublicClasses";

const Programs = () => {
  const { classes, isLoading } = usePublicClasses();
  const [bookingTemplateId, setBookingTemplateId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="max-w-5xl mx-auto px-6 lg:px-8 py-20 lg:py-32 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-sans font-medium mb-4">
          What we offer
        </p>
        <h1 className="text-3xl lg:text-5xl font-serif text-foreground leading-relaxed mb-6">
          Classes for every body, every level.
        </h1>
        <p className="text-lg text-muted-foreground font-serif max-w-2xl mx-auto">
          From traditional Ashtanga Mysore to Pilates, Yin Yoga, and specialist classes for parents
          and new mothers. Book any class through our booking flow.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-24 lg:pb-36">
        {isLoading ? (
          <div className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-52 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <p className="text-center text-muted-foreground py-16 font-serif text-lg">
            No classes listed yet.
          </p>
        ) : (
          <div className="space-y-6">
            {classes.map((cls) => {
              const instructorNames = [
                ...new Set(
                  cls.rules
                    .map((r) => r.instructor_name)
                    .filter(Boolean) as string[]
                ),
              ];
              const schedule = formatSchedule(cls.rules);

              return (
                <div
                  key={cls.id}
                  className="grid grid-cols-1 lg:grid-cols-[280px_1fr_auto] gap-6 items-center bg-card rounded-xl p-6 lg:p-8"
                >
                  {cls.image_url ? (
                    <img
                      src={cls.image_url}
                      alt={cls.name}
                      className="w-full lg:w-[280px] aspect-[4/3] object-cover rounded-lg"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full lg:w-[280px] aspect-[4/3] rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-3xl font-serif text-muted-foreground/40">
                        {cls.name.charAt(0)}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h2 className="text-xl lg:text-2xl font-serif text-card-foreground">
                        {cls.name}
                      </h2>
                      {cls.level && (
                        <span className="text-xs font-sans font-medium uppercase tracking-wider bg-secondary text-foreground px-3 py-1 rounded-full">
                          {cls.level}
                        </span>
                      )}
                    </div>
                    {cls.description && (
                      <p className="text-sm text-muted-foreground font-sans leading-relaxed">
                        {cls.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 pt-2 text-xs font-sans text-muted-foreground">
                      {instructorNames.length > 0 && (
                        <span>
                          <span className="font-medium text-foreground">Instructor:</span>{" "}
                          {instructorNames.join(", ")}
                        </span>
                      )}
                      <span>
                        <span className="font-medium text-foreground">Duration:</span>{" "}
                        {cls.default_duration_minutes} min
                      </span>
                    </div>
                    {schedule && (
                      <p className="text-xs font-sans text-muted-foreground pt-1">
                        <span className="font-medium text-foreground">Schedule:</span> {schedule}
                      </p>
                    )}
                  </div>

                  <div className="lg:self-center">
                    <button
                      onClick={() => setBookingTemplateId(cls.id)}
                      className="w-full lg:w-auto whitespace-nowrap bg-primary hover:bg-primary/80 text-primary-foreground px-6 py-3 font-sans font-medium text-sm uppercase tracking-wider rounded-lg transition-all duration-200"
                    >
                      Book
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Footer />

      <BookingSheet
        isOpen={bookingTemplateId !== null}
        onClose={() => setBookingTemplateId(null)}
        templateId={bookingTemplateId ?? undefined}
      />
    </div>
  );
};

export default Programs;
