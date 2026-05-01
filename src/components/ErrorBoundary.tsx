import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md text-center space-y-4 px-6">
            <h1 className="text-2xl font-serif text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground font-sans">
              An unexpected error occurred. Please reload the page.
            </p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground text-sm font-sans uppercase tracking-[0.15em] rounded-lg"
            >
              Reload
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
