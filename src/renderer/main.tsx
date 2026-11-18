import { createRoot } from 'react-dom/client';
import logo from '../../docs/images/logo.jpg';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <main>
    <img src={logo} alt="Illustrated hands inside a pastel rainbow" width={160} height={160} />
    <h1>A-B Sign!</h1>
    <p>Filipino Sign Language teaching and practice.</p>
    <p className="status">Development build</p>
  </main>,
);
