import { useEffect, useState } from 'react';
import { getToday } from '../utils/transactionValidation';

export default function useToday() {
  const [today, setToday] = useState(getToday);
  useEffect(() => {
    const update = () => setToday(getToday());
    const timer = window.setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, []);
  return today;
}
