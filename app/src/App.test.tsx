import { render, screen } from '@testing-library/react';
import App from './App';

test('pokazuje logowanie bez publicznej rejestracji i panelu administratora', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Zaloguj się' })).toBeInTheDocument();
  expect(screen.getByText('Nie pamiętasz hasła? Poproś administratora o reset.')).toBeInTheDocument();
  expect(screen.queryByText('Zarządzaj kontami')).not.toBeInTheDocument();
  expect(screen.queryByText('Zarejestruj się')).not.toBeInTheDocument();
});
