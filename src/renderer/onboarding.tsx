import logo from '../../docs/images/logo.jpg';
import { Icon } from './icons';
import type { ClassroomStore } from './classroom';

export function Welcome({ store }: { store: ClassroomStore }) {
  return <section className="welcome welcome-start">
    <div className="welcome-art"><img src={logo} width="300" height="300" alt="Three illustrated hands inside a rainbow" /></div>
    <div className="welcome-copy"><h1>Welcome to <span>A-B Sign!</span></h1><p>Open a lesson or make one of your own.</p>
      <div className="actions centered">
        <button className="button primary" onClick={() => { store.update({ setup: true }); window.location.hash = 'path'; }}>See lessons <Icon name="arrow" /></button>
        <button className="button secondary" onClick={() => { store.update({ setup: true }); window.location.hash = 'builder/new'; }}>Create a lesson</button>
      </div>
    </div>
  </section>;
}
