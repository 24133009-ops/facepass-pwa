import React, { lazy, Suspense, useState } from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  private retry = () => {
    this.props.onRetry?.();
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
        <div role="alertdialog" aria-modal="true" aria-labelledby="modal-load-error" className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
          <h2 id="modal-load-error" className="font-bold text-slate-900">Không thể mở nội dung này</h2>
          <p className="text-sm text-slate-600">Vui lòng thử lại. Tải lại trang sẽ yêu cầu đăng nhập lại.</p>
          <Button type="button" onClick={this.retry}>Thử lại</Button>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>Tải lại trang</Button>
        </div>
      </div>
    );
  }
}

// Recreate React.lazy on retry: a rejected lazy import otherwise stays rejected.
export function lazyModal<Props extends object>(
  load: () => Promise<{ default: React.FC<Props> }>
): React.FC<Props> {
  return function LazyModal(props: Props) {
    const [Content, setContent] = useState(() => lazy(load));

    return (
      <ErrorBoundary onRetry={() => setContent(() => lazy(load))}>
        <Suspense fallback={null}>
          <Content {...(props as React.JSX.IntrinsicAttributes & React.ComponentProps<typeof Content>)} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}
