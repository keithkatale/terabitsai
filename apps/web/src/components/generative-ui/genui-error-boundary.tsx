"use client";

import * as React from "react";
import { QuantUiFailure } from "@/components/quant-ui/quant-ui-failure";

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
  rawPayload?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GenUiErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[GenUI] Runtime render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message ?? "Unknown render error";
      
      return (
        <QuantUiFailure
          title={this.props.fallbackTitle ?? "Interface failed to render"}
          reason="A component crashed while rendering. This usually means the data format was unexpected."
          errorDetails={`Runtime error: ${errorMessage}`}
          rawPayload={this.props.rawPayload}
        />
      );
    }

    return this.props.children;
  }
}

/** HOC wrapper for functional components */
export function withGenUiErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallbackTitle?: string
): React.FC<P & { rawPayload?: string }> {
  return function WrappedComponent(props: P & { rawPayload?: string }) {
    const { rawPayload, ...rest } = props;
    return (
      <GenUiErrorBoundary fallbackTitle={fallbackTitle} rawPayload={rawPayload}>
        <Component {...(rest as P)} />
      </GenUiErrorBoundary>
    );
  };
}
