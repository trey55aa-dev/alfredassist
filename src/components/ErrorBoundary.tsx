import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCcw, RotateCcw } from "lucide-react";

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

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Alfred] render error:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-5">
          <div className="font-display text-5xl text-gold/50">✦</div>
          <h2 className="font-display text-2xl">Something went wrong</h2>
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground/60 break-all">
            {error.name}: {error.message}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm hover:border-gold/40 hover:text-gold transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-md bg-gold/10 border border-gold/30 px-4 py-2 text-sm text-gold hover:bg-gold/20 transition-colors"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
