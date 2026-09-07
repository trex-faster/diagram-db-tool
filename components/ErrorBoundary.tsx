"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("DiagramCanvas crashed:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
          <h1 className="text-lg font-bold text-red-700">Algo se rompió en el canvas</h1>
          <p className="max-w-md text-sm text-gray-600">
            {this.state.error.message || "Ocurrió un error inesperado."} Tu último diagrama
            autoguardado sigue intacto en el navegador — probá recargar la página.
          </p>
          <div className="flex gap-2">
            <button
              className="rounded bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700"
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>
            <button
              className="rounded border px-4 py-2 text-sm hover:bg-gray-100"
              onClick={this.handleReset}
            >
              Reintentar sin recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
