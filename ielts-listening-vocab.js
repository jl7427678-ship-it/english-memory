// Entry point for the curated deck; training and progress use the existing engine.
(() => {
  const deckId = 'ielts_listening_300';
  const panel = document.getElementById('ieltsListeningWords');
  const status = document.getElementById('ieltsListeningWordsStatus');
  if (!panel || !status) return;
  let pending = false;

  panel.querySelectorAll('[data-listening-words]').forEach(button => {
    button.addEventListener('click', async () => {
      if (pending) return;
      pending = true;
      const buttons = panel.querySelectorAll('button');
      buttons.forEach(item => { item.disabled = true; });
      status.textContent = '正在打开 300 词词库…';
      try {
        primeSpeech();
        const deck = await ensureBuiltinDeck(deckId);
        renderVocabHome();
        status.textContent = '300 词已就绪，学习进度自动保存。空格或 0 发音，1–4 选择答案。';
        if (button.dataset.listeningWords === 'browse') {
          openVocabBrowser(deck);
        } else {
          document.getElementById('vocabBrowser').hidden = true;
          if (button.dataset.listeningWords === 'spell') startVocabSpell(deckId);
          else startVocabContinue(deckId);
        }
      } catch (error) {
        console.warn('Listening vocabulary could not be opened', error);
        status.textContent = '词库暂时加载失败，请联网后再次点击重试。';
      } finally {
        pending = false;
        buttons.forEach(item => { item.disabled = false; });
      }
    });
  });

  if (new URLSearchParams(location.search).get('deck') === deckId) {
    nav('vocab');
    panel.scrollIntoView({ block: 'start' });
    panel.focus({ preventScroll: true });
  }
})();
