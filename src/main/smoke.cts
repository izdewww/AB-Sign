import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserWindow } from 'electron';

export async function verifyDesktop(window: BrowserWindow) {
  const runner = window.webContents;
  const motion = (value: 'no-preference' | 'reduce') => runner.debugger.sendCommand('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value }],
  });
  runner.debugger.attach('1.3');
  await motion('no-preference');
  const waitFor = (condition: string, timeout = 5000) => runner.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + ${timeout};
    const timer = setInterval(() => {
      if (${condition}) { clearInterval(timer); resolve(true); }
      else if (Date.now() > end) { clearInterval(timer); reject(new Error(${JSON.stringify(condition)} + '\\n' + (document.querySelector('main')?.innerText ?? '').slice(0, 500))); }
    }, 25);
  })`);
  const click = async (selector: string) => {
    const target = `document.querySelector(${JSON.stringify(selector)})`;
    await waitFor(target);
    return runner.executeJavaScript(`${target}.click()`);
  };
  const navigate = (hash: string) => runner.executeJavaScript(`location.hash = ${JSON.stringify(hash)}`);
  const button = async (label: string) => {
    const target = `Array.from(document.querySelectorAll('button')).find(node => !node.disabled && node.textContent.trim() === ${JSON.stringify(label)})`;
    await waitFor(target);
    return runner.executeJavaScript(`(${target}).click()`);
  };
  const heading = (label: string) => waitFor(`document.querySelector('h1')?.textContent === ${JSON.stringify(label)}`);
  const reload = async () => {
    const done = once(runner, 'did-finish-load');
    runner.reload();
    await done;
  };
  const capture = async (name: string) => {
    const folder = process.env.AB_SIGN_SMOKE_DIR;
    if (!folder) return;
    await runner.executeJavaScript(`document.fonts.ready.then(() => Promise.all(Array.from(document.images, img => img.decode())))`);
    await runner.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const image = await window.capturePage();
    await writeFile(join(folder, `${name}.png`), image.toPNG());
  };

  const field = (selector: string, value: string) => runner.executeJavaScript(`(() => {
    const field = document.querySelector(${JSON.stringify(selector)});
    const prototype = field.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, ${JSON.stringify(value)});
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  })()`);
  const picture = (width = 80) => runner.executeJavaScript(`new Promise(resolve => {
    const canvas = document.createElement('canvas'); canvas.width = ${width}; canvas.height = 80;
    const context = canvas.getContext('2d'); context.fillStyle = '${width === 80 ? '#f093b1' : '#c2aff4'}'; context.fillRect(0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      const input = document.querySelector('[data-media=image]'); const files = new DataTransfer();
      files.items.add(new File([blob], 'teacher-picture.png', { type: 'image/png' }));
      input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true })); resolve(true);
    });
  })`);
  const ready = () => waitFor(`!document.querySelector('.builder-footer button.primary:disabled')`);
  const title = '.simple-form input:not([type])';
  const letter = '.editor-fields label:nth-child(2) select';
  const teacherPassword = 'ClassroomExample24!';
  const teacherLogin = async (password = teacherPassword) => {
    await navigate('teacher-sign-in');
    await heading('Teacher sign-in');
    await field('#teacher-password', password);
    await button('Sign in');
  };
  const selectStudent = async (name: string) => {
    await heading('Who is learning today?');
    await button(name);
    await heading('Hi, ' + name + '! Ready to sign?');
  };

  await waitFor(`document.querySelector('.account-entry h1') && document.querySelector('.brand img')?.naturalWidth > 0`);
  const asset = await runner.executeJavaScript(`fetch('/vision/fsl-az-v2.task').then(r => r.ok && r.arrayBuffer()).then(b => b.byteLength > 0)`);
  if (!asset) throw new Error('The local model could not be read.');
  await waitFor(`document.querySelector('#student-name') && Array.from(document.querySelectorAll('button, a')).some(node => node.textContent.trim() === 'Teacher sign-in')`);
  await capture('local-accounts');
  await field('#student-name', 'Maya');
  await button('Start learning');
  await heading('Hi, Maya! Ready to sign?');
  await navigate('students');
  await heading('Teacher area');
  await waitFor(`window.localAccounts !== undefined && !document.querySelector('.roster')`);
  const denied = await runner.executeJavaScript(`window.localAccounts.request({ action:'state' }).then(({state}) => window.localAccounts.request({ action:'student-progress', id: state.students[0].id })).then(reply => !reply.ok)`);
  if (!denied) throw new Error('A student could open teacher progress.');
  await navigate('path');
  await heading('Learning path');
  await waitFor(`document.querySelectorAll('[data-category]').length === 6`);
  await capture('category-path');
  await navigate('category/numbers');
  await heading('Numbers');
  await waitFor(`document.querySelector('main').innerText.includes('No lessons here yet') && !document.querySelector('main a[href^="#builder"]')`);
  await navigate('category/alphabet');
  await heading('Alphabet & Letters');
  await waitFor(`JSON.stringify(Array.from(document.querySelectorAll('.library-cover'), node => node.textContent)) === JSON.stringify(['ABC','DEF','GHI','JKL','MNO','PQR','STU','VWX','YZ'])`);
  await capture('lesson-library');
  await navigate('lesson/alphabet-4/demo/0');
  await heading('Look at J');
  await waitFor(`document.querySelector('.study-stage p').textContent.includes('moving sign') && document.querySelector('.study-stage img').naturalWidth > 0`);

  await button('Switch account');
  await heading('Who is learning today?');
  await teacherLogin('wrong-password');
  await waitFor(`document.querySelector('[role=alert]')?.textContent.includes('does not match')`);
  await teacherLogin('TeacherStart24!');
  await heading('Set your teacher password');
  await field('[name=current]', 'incorrect-starting-password');
  await field('[name=password]', teacherPassword);
  await field('[name=confirm]', teacherPassword);
  await button('Save password');
  await waitFor(`document.querySelector('[role=alert]')?.textContent.includes('does not match')`);
  await field('[name=current]', 'TeacherStart24!');
  await button('Save password');
  await heading('Classroom');

  await navigate('builder/alphabet-9');
  await heading('Edit lesson');
  await waitFor(`document.querySelector('.media-fields').textContent.includes('No video added')`);
  await picture();
  await waitFor(`document.querySelector('.media-fields').textContent.includes('teacher-picture.png')`);
  await button('Use on this device');
  await waitFor(`document.querySelector('.builder-footer [role=status]').textContent === 'Lesson ready on this device.'`);
  await navigate('lesson/alphabet-9/demo/0');
  await heading('Look at Y');
  await waitFor(`document.querySelector('.study-stage img').src.startsWith('blob:') && document.querySelector('.study-stage img').naturalWidth === 80`);

  await navigate('builder/new');
  await heading('Create a lesson');
  await waitFor(`document.querySelector('.simple-form input').value === '' && !document.querySelector('.builder-steps li')`);
  await button('Use on this device');
  await waitFor(`document.querySelector('[role=alert]').textContent === 'Give the lesson a name.'`);
  await field(title, 'Practice with me');
  await button('Add step');
  await waitFor(`document.querySelector(${JSON.stringify(letter)}).value === ''`);
  await field(letter, 'B');
  await picture();
  await waitFor(`document.querySelector('.media-fields').textContent.includes('teacher-picture.png')`);
  await ready();
  await runner.executeJavaScript(`new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80;
    const paint = canvas.getContext('2d'); paint.fillStyle = '#caafe3'; paint.fillRect(0, 0, 100, 80);
    const stream = canvas.captureStream(12); const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const parts = []; recorder.ondataavailable = event => parts.push(event.data);
    recorder.onerror = reject;
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      const field = document.querySelector('[data-media="video"]'); const files = new DataTransfer();
      files.items.add(new File(parts, 'smoke-clip.webm', { type: 'video/webm' }));
      field.files = files.files; field.dispatchEvent(new Event('change', { bubbles: true })); resolve(true);
    };
    let frame = 0;
    recorder.start();
    const timer = setInterval(() => {
      paint.fillStyle = ++frame % 2 ? '#1967d2' : '#1b7339'; paint.fillRect(1, 1, 35, 35);
      if (frame === 12) { clearInterval(timer); recorder.stop(); }
    }, 90);
  })`);
  await waitFor(`document.querySelector('.media-fields')?.textContent.includes('smoke-clip.webm')`, 8500);
  await ready();
  await button('Add step');
  await field(letter, 'D');
  await button('Add quiz');
  await click('.quiz-variables fieldset:first-child input[type=checkbox]:nth-of-type(1)');
  await click('.quiz-variables fieldset:first-child label:nth-of-type(2) input');
  await click('.quiz-variables fieldset:nth-child(2) label:first-of-type input');
  await field('.quiz-length select', '3');
  await waitFor(`document.querySelector('.quiz-variables fieldset:nth-child(2) label:nth-of-type(2)').textContent.trim() === 'Camera'`);
  await button('Save draft');
  await heading('Edit lesson');
  const editHash = await runner.executeJavaScript('location.hash.slice(1)');
  await reload();
  await heading('Edit lesson');
  await waitFor(`document.querySelector('.simple-form input').value === 'Practice with me' && document.querySelectorAll('.quiz-variables input:checked').length === 3 && document.querySelector('.quiz-length select').value === '3' && document.querySelector('[data-media=video]').parentElement.textContent.includes('smoke-clip.webm')`);
  await capture('lesson-editor');
  await button('Preview');
  await heading('Watch B');
  await waitFor(`document.querySelector('.lesson-video video')?.readyState >= 1`);
  await button('Play slowly');
  await waitFor(`document.querySelector('.lesson-video video').playbackRate === .5`);
  await button('Replay');
  await waitFor(`document.querySelector('.lesson-video video').currentTime > 0`);
  await button('Back to editing');
  await button('Use on this device');
  await waitFor(`document.querySelector('.builder-footer [role=status]').textContent === 'Lesson ready on this device.'`);
  await button('Sign out');
  await selectStudent('Maya');
  await navigate('lesson/' + editHash.split('/')[1]);
  await heading('Practice with me');
  await click('a.button[href$="/demo/0"]');
  await heading('Watch B');
  await button('Next step');
  await heading('Look at D');
  await button('Finish lesson');
  await heading('Lesson finished!');
  await waitFor(`document.querySelector('.confetti span') && document.querySelector('.badge-list').textContent.includes('Lesson badge')`);
  // Sample the middle of the real CSS animation so hidden-window frame scheduling does not race the capture.
  await runner.executeJavaScript(`document.querySelector('.confetti').getAnimations({ subtree: true }).forEach(animation => {
    animation.pause();
    animation.currentTime = 550;
  })`);
  await waitFor(`Array.from(document.querySelectorAll('.confetti span')).some(node => {
    const points = node.getBoundingClientRect();
    const card = document.querySelector('.celebrate-card').getBoundingClientRect();
    return Number(getComputedStyle(node).opacity) > .5 && points.top >= card.top && points.bottom <= card.bottom;
  })`);
  await capture('lesson-celebration');
  await motion('reduce');
  await waitFor(`getComputedStyle(document.querySelector('.confetti')).display === 'none' && document.querySelector('.badge-list').textContent.includes('Lesson badge')`);
  await motion('no-preference');
  await click('a.button[href$="/quiz"]');
  await heading('Practice with me quiz');

  const types = new Set<string>();
  for (let question = 1; question <= 3; question++) {
    await waitFor(`document.querySelector('.question-count').textContent === '${question} of 3'`);
    const kind = await runner.executeJavaScript('document.querySelector("[data-question-kind]").dataset.questionKind');
    types.add(kind);
    if (kind === 'camera') await button('Use pictures');
    await waitFor(`document.querySelector('.sign-stage img')?.complete && document.querySelector('.sign-stage img')?.naturalWidth > 0 && document.querySelectorAll('.choices .choice').length === 2`);
    const answer = await runner.executeJavaScript(`document.querySelector('.sign-stage img').src.startsWith('blob:') ? 'B' : 'D'`);
    if (question === 1) await capture('lesson-quiz');
    await button(question === 1 ? (answer === 'B' ? 'D' : 'B') : answer);
    await button('Check answer');
    await waitFor(`document.querySelector('.lesson-footer').dataset.feedback === '${question === 1 ? 'retry' : 'right'}'`);
    await button(question === 3 ? 'See my result' : 'Next question');
  }
  if (types.size !== 2) throw new Error('The round should include both question formats.');
  await heading('Round finished!');
  await reload();
  await waitFor(`document.querySelector('.score').textContent === '2 of 3 correct'`);
  await button('Switch account');
  await heading('Who is learning today?');
  await field('#student-name', 'Leo');
  await button('Start learning');
  await heading('Hi, Leo! Ready to sign?');
  await navigate('progress');
  await heading('Your progress');
  await waitFor(`document.querySelector('main').innerText.includes('0 of 10 finished') && !document.querySelector('main').innerText.includes('Practice with me')`);
  await button('Switch account');
  await heading('Who is learning today?');
  await teacherLogin();
  await heading('Classroom');
  await navigate('students');
  await heading('Students');
  await capture('teacher-roster');
  await click('button[aria-label="Edit Maya"]');
  await waitFor(`document.querySelector('dialog[open] input').value === 'Maya'`);
  await field('dialog input', 'Maya S');
  await button('Save name');
  await waitFor(`!document.querySelector('dialog') && document.querySelector('.roster').textContent.includes('Maya S')`);
  await click('.roster li:first-child a');
  await heading('Maya S’s progress');
  await waitFor(`document.querySelector('main').innerText.includes('Practice with me') && document.querySelector('main').innerText.includes('2 of 3 correct')`);
  await navigate('students');
  await heading('Students');
  await click('button[aria-label="Remove Leo"]');
  await waitFor(`document.querySelector('dialog[open]').textContent.includes('Remove Leo?')`);
  await button('Cancel');
  await waitFor(`!document.querySelector('dialog') && document.querySelector('button[aria-label="Remove Leo"]')`);
  await click('button[aria-label="Remove Leo"]');
  await waitFor(`document.querySelector('dialog[open]')`);
  await button('Remove student');
  await waitFor(`!document.querySelector('button[aria-label="Remove Leo"]')`);
  await navigate('builder');
  await heading('Lesson builder');
  await waitFor(`Array.from(document.querySelectorAll('button')).some(button => button.textContent === 'Hide alphabet lessons')`);
  await button('Hide alphabet lessons');
  await waitFor(`document.querySelector('.notice').textContent.includes('hidden')`);
  await navigate('category/alphabet');
  await reload();
  await waitFor(`document.querySelectorAll('.library-card').length === 1 && document.querySelector('.library-card h2').textContent === 'Practice with me'`);
  await navigate('builder');
  await waitFor(`Array.from(document.querySelectorAll('button')).some(button => button.textContent === 'Show alphabet lessons')`);
  await button('Show alphabet lessons');
  await waitFor(`document.querySelector('.notice').textContent.includes('visible')`);
  await navigate('category/alphabet');
  await waitFor(`document.querySelectorAll('.library-card').length === 10`);
  window.setSize(800, 760);
  await waitFor(`window.innerWidth <= 820 && document.documentElement.scrollWidth <= window.innerWidth`);
  await capture('lesson-library-compact');
  await navigate(editHash);
  await heading('Edit lesson');
  await waitFor(`document.documentElement.scrollWidth <= window.innerWidth`);
  await navigate('builder/new/numbers');
  await heading('Create a lesson');
  await waitFor(`document.querySelector('.builder-editor select').value === 'numbers'`);
  await field(title, 'First numbers');
  for (const [term, width] of [['1', 80], ['2', 96]] as const) {
    await button('Add step');
    await field('.editor-fields input', term);
    await picture(width);
    await waitFor(`document.querySelector('.learner-preview img')?.naturalWidth === ${width}`);
    await ready();
  }
  await button('Add quiz');
  await waitFor(`document.querySelectorAll('.quiz-variables input').length === 2 && !document.querySelector('.quiz-variables').textContent.includes('Camera')`);
  await click('.quiz-variables fieldset:first-child input');
  await click('.quiz-variables fieldset:nth-child(2) input');
  await field('.quiz-length select', '2');
  await button('Use on this device');
  await heading('First numbers');
  const numberHash = await runner.executeJavaScript('location.hash.slice(1)');
  await navigate('builder/new/words');
  await heading('Create a lesson');
  await field(title, 'Everyday words');
  await button('Add step');
  await field('.editor-fields input', 'Hello');
  await picture();
  await waitFor(`document.querySelector('.learner-preview img')?.naturalWidth === 80`);
  await button('Use on this device');
  await heading('Everyday words');
  await button('Sign out');
  await selectStudent('Maya S');
  await navigate('category/words');
  await heading('Words');
  await click('.library-card');
  await heading('Everyday words');
  await click('a.button[href$="/demo/0"]');
  await heading('Hello');
  await waitFor(`document.querySelector('.study-stage img')?.naturalWidth === 80 && !document.querySelector('.camera-controls')`);
  await navigate(numberHash + '/demo/0');
  await heading('1');
  await waitFor(`document.querySelector('.study-stage img')?.naturalWidth === 80`);
  await button('Next step');
  await heading('2');
  await button('Finish lesson');
  await heading('Lesson finished!');
  await waitFor(`document.querySelector('.badge-list').textContent.includes('Numbers badge')`);
  await navigate(numberHash + '/quiz');
  await heading('First numbers quiz');
  for (let question = 1; question <= 2; question++) {
    await waitFor(`document.querySelector('.question-count').textContent === '${question} of 2' && document.querySelector('.sign-stage img')?.naturalWidth > 0 && document.querySelector('[data-question-kind=match]')`);
    const answer = await runner.executeJavaScript(`document.querySelector('.sign-stage img').naturalWidth === 80 ? '1' : '2'`);
    await button(answer);
    await button('Check answer');
    await button(question === 1 ? 'Next question' : 'See my result');
  }
  await waitFor(`document.querySelector('.score').textContent === '2 of 2 correct'`);
  await navigate('activities');
  await heading('Activities & games');
  await waitFor(`document.querySelectorAll('.activity-grid a').length === 4`);
  await click('.activity-grid a[href="#activities/words"]');
  await heading('Vocabulary challenge');
  await waitFor(`document.querySelector('.lesson-list').textContent.includes('First numbers')`);
  await navigate('camera-setup');
  await heading('Let’s check your camera');
  await waitFor(`document.querySelector('main video') && !document.querySelector('main video').srcObject`);

  await navigate('camera');
  await heading('Camera practice');
  await waitFor(`!document.querySelector('video') && Array.from(document.querySelectorAll('.letter-picker a'), node => node.textContent.trim()).join('') === 'ABCDEFGHIKLMNOPQRSTUVWXY'`);
  await waitFor(`document.documentElement.scrollWidth <= window.innerWidth`);
  for (const sign of ['J', 'Z']) {
    await navigate('camera/' + sign);
    await runner.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await waitFor(`location.hash === '#camera/${sign}' && !document.querySelector('.camera-hint') && !document.querySelector('video')`);
  }
  await capture('alphabet-camera');
  for (const sign of ['B', 'D']) {
    await click('a[href="#camera/' + sign + '"]');
    await waitFor(`document.querySelector('.camera-hint h2')?.textContent === 'Sign ${sign}'`);
    await button('Show hint');
    await runner.executeJavaScript(`(async () => {
      const source = document.querySelector('.camera-hint img'); await source.decode();
      const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
      const paint = canvas.getContext('2d');
      const draw = () => paint.drawImage(source, 0, 0); draw();
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(12);
      const timer = setInterval(draw, 85);
      window.restoreSmokeCamera = () => { clearInterval(timer); navigator.mediaDevices.getUserMedia = original; };
    })()`);
    await button('Start camera');
    await waitFor(`Array.from(document.querySelectorAll('.camera-controls button')).some(node => node.textContent === 'Save match')`, 20000);
    await button('Save match');
    await waitFor(`document.querySelector('video').srcObject === null`);
    await runner.executeJavaScript('window.restoreSmokeCamera()');
  }

  await runner.executeJavaScript(`new Promise((resolve, reject) => {
    const request = indexedDB.open('ab-sign-lessons', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const lesson = {
        id: 'saved-motion-lesson', title: 'Moving letters', revision: 1,
        steps: [
          { id: 'motion-j', letter: 'J', kind: 'camera' },
          { id: 'motion-z', letter: 'Z', kind: 'look' },
          { id: 'read-book', kind: 'spell', word: 'BOOK' },
        ],
        quiz: { count: 3, prompts: [
          { letter: 'J', kind: 'camera' }, { letter: 'J', kind: 'match' }, { letter: 'Z', kind: 'camera' },
        ] },
      };
      const transaction = database.transaction('lessons', 'readwrite');
      transaction.objectStore('lessons').put({ id: lesson.id, draft: lesson, published: lesson });
      transaction.oncomplete = () => { database.close(); resolve(true); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  })`);
  await reload();
  await button('Switch account');
  await heading('Who is learning today?');
  await teacherLogin();
  await heading('Classroom');
  await navigate('builder/saved-motion-lesson');
  await heading('Edit lesson');
  await waitFor(`document.querySelector('[data-media=video]') && Array.from(document.querySelectorAll('.quiz-variables fieldset')).slice(0, 2).every(group => group.querySelectorAll('input:checked').length === 1 && group.querySelectorAll('input').length === 1)`);
  await button('Sign out');
  await selectStudent('Maya S');
  await navigate('lesson/saved-motion-lesson/demo/0');
  await heading('Look at J');
  await waitFor(`document.querySelector('.study-stage img')?.naturalWidth > 0 && !document.querySelector('video')`);
  await navigate('lesson/saved-motion-lesson/quiz');
  await heading('Moving letters quiz');
  for (let number = 1; number <= 2; number++) {
    await waitFor(`document.querySelector('.question-count').textContent === '${number} of 2' && document.querySelector('[data-question-kind=match]') && document.querySelector('.sign-stage img')?.naturalWidth > 0`);
    const answer = await runner.executeJavaScript(`document.querySelector('.sign-stage img').src.includes('sign-j-') ? 'J' : 'Z'`);
    await button(answer);
    await button('Check answer');
    await button(number === 1 ? 'Next question' : 'See my result');
  }
  await waitFor(`document.querySelector('.score')?.textContent === '2 of 2 correct'`);
  await navigate('category/alphabet');
  await heading('Alphabet & Letters');
  await waitFor(`document.querySelector('a[href="#lesson/saved-motion-lesson"] .library-cover').textContent === 'JZ'`);
  await navigate('lesson/saved-motion-lesson');
  await heading('Moving letters');
  await waitFor(`!document.querySelector('main').innerText.includes('BOOK')`);
  await navigate('lesson/saved-motion-lesson/demo/2');
  await heading('Read the signs');
  await waitFor(`!document.querySelector('main input') && document.querySelectorAll('.spell-word span').length === 4 && !document.querySelector('main').innerText.includes('BOOK')`);
  await waitFor(`document.querySelector('.fingerspelling .lesson-footer .primary').getBoundingClientRect().bottom <= window.innerHeight`);
  await capture('fingerspelling');
  for (const [index, answer] of [...'BOOK'].entries()) {
    await waitFor(`document.querySelector('.spell-position').textContent === 'Sign ${index + 1} of 4' && document.querySelector('.sign-stage img')?.src.includes('sign-${answer.toLowerCase()}-')`);
    if (index === 0) {
      await runner.executeJavaScript(`Array.from(document.querySelectorAll('.answer-cards .choice')).find(node => node.textContent.trim() !== 'B').click()`);
      await button('Check answer');
      await waitFor(`document.querySelector('.lesson-footer [role=status]').textContent.includes('Try again') && document.querySelector('.spell-position').textContent === 'Sign 1 of 4'`);
    }
    await button(answer);
    await button('Check answer');
    await button(index === 3 ? 'See the word' : 'Next sign');
  }
  await waitFor(`document.querySelector('.spell-result').textContent === 'BOOK'`);
  await button('Finish lesson');
  await heading('Lesson finished!');
}
