import { Component } from 'react';

export default class ChartErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-800">The spending chart couldn’t load</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Your summary and category totals are still available. Reload the page to try again.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">Reload page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
