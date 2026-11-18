import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserWindow } from 'electron';

export async function verifyDesktop(window: BrowserWindow) {
  const runner = window.webContents;
  const waitFor = (condition: string, timeout = 5000) => runner.executeJavaScript(`new Promise((resolve, reject) => {
    const end = Date.now() + ${timeout};
    const timer = setInterval(() => {
      if (${condition}) { clearInterval(timer); resolve(true); }
      else if (Date.now() > end) { clearInterval(timer); reject(new Error(${JSON.stringify(condition)} + '\\n' + (document.querySelector('main')?.innerText ?? '').slice(0, 500))); }
    }, 25);
  })`);
  const click = (selector: string) => runner.executeJavaScript(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const navigate = (hash: string) => runner.executeJavaScript(`location.hash = ${JSON.stringify(hash)}`);
  const button = (label: string) => runner.executeJavaScript(`([...document.querySelectorAll('button')].find(node => node.textContent.trim() === ${JSON.stringify(label)})).click()`);
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
  const picture = () => runner.executeJavaScript(`new Promise(resolve => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80;
    const context = canvas.getContext('2d'); context.fillStyle = '#f093b1'; context.fillRect(0, 0, 80, 80);
    canvas.toBlob(blob => {
      const input = document.querySelector('[data-media=image]'); const files = new DataTransfer();
      files.items.add(new File([blob], 'teacher-picture.png', { type: 'image/png' }));
      input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true })); resolve(true);
    });
  })`);
  const ready = () => waitFor(`!document.querySelector('.builder-footer button.primary:disabled')`);
  const title = '.simple-form input:not([type])';
  const letter = '.editor-fields label:nth-child(2) select';

  await waitFor(`document.querySelector('.welcome h1') && document.querySelector('.brand img')?.naturalWidth > 0`);
  const asset = await runner.executeJavaScript(`fetch('/vision/fsl-az-v2.task').then(r => r.ok && r.arrayBuffer()).then(b => b.byteLength > 0)`);
  if (!asset) throw new Error('The local model could not be read.');
  await button('See lessons');
  await heading('Learning path');
  await waitFor(`JSON.stringify(Array.from(document.querySelectorAll('.library-cover'), node => node.textContent)) === JSON.stringify(['ABC','DEF','GHI','JKL','MNO','PQR','STU','VWX','YZ'])`);
  await capture('lesson-library');
  await navigate('lesson/alphabet-4/demo/0');
  await heading('Look at J');
  await waitFor(`document.querySelector('.study-stage p').textContent.includes('moving sign') && document.querySelector('.study-stage img').naturalWidth > 0`);

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
  await click('.builder-footer a');
  await heading('Practice with me');
  await click('a.button[href$="/demo/0"]');
  await heading('Watch B');
  await button('Next step');
  await heading('Look at D');
  await button('Finish lesson');
  await heading('Lesson finished!');
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
  await navigate('builder');
  await heading('Lesson builder');
  await waitFor(`Array.from(document.querySelectorAll('button')).some(button => button.textContent === 'Hide alphabet lessons')`);
  await button('Hide alphabet lessons');
  await waitFor(`document.querySelector('.notice').textContent.includes('hidden')`);
  await navigate('path');
  await reload();
  await waitFor(`document.querySelectorAll('.library-card').length === 1 && document.querySelector('.library-card h2').textContent === 'Practice with me'`);
  await navigate('builder');
  await waitFor(`Array.from(document.querySelectorAll('button')).some(button => button.textContent === 'Show alphabet lessons')`);
  await button('Show alphabet lessons');
  await waitFor(`document.querySelector('.notice').textContent.includes('visible')`);
  await navigate('path');
  await waitFor(`document.querySelectorAll('.library-card').length === 10`);
  window.setSize(800, 760);
  await waitFor(`window.innerWidth <= 820 && document.documentElement.scrollWidth <= window.innerWidth`);
  await capture('lesson-library-compact');
  await navigate(editHash);
  await heading('Edit lesson');
  await waitFor(`document.documentElement.scrollWidth <= window.innerWidth`);

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
  await navigate('builder/saved-motion-lesson');
  await heading('Edit lesson');
  await waitFor(`document.querySelector('[data-media=video]') && Array.from(document.querySelectorAll('.quiz-variables fieldset')).every(group => group.querySelectorAll('input:checked').length === 1 && group.querySelectorAll('input').length === 1)`);
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
}
