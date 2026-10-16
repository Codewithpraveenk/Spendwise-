import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import App from '../src/App';
import { AuthContext } from '../src/state/useAuth';

export function renderRoute(path, status = 'anonymous', user = null) {
  return renderToString(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={{ status, user, error: null, clearError() {} }}><App /></AuthContext.Provider></MemoryRouter>);
}
