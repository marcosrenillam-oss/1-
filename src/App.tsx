import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Mode } from './data/types';
import { abandonRun, sanitizeRun, startRun, submitAnswer, type RunResult } from './engine/game';
import { defaultRng } from './engine/rng';
import { loadSave, requestPersistence, writeSave, type ActiveRun, type SaveData } from './storage/persistence';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ResultScreen } from './screens/ResultScreen';
import { VictoryScreen } from './screens/VictoryScreen';
import { motionMs } from './motion';
import { setSafeToUpdate } from './pwa';

type Screen =
  | { name: 'home' }
  | { name: 'game' }
  | { name: 'result'; result: RunResult }
  | { name: 'victory'; result: RunResult };

const rng = defaultRng();

export default function App() {
  const [save, setSave] = useState<SaveData>(() => sanitizeRun(loadSave()));
  const [mode, setMode] = useState<Mode>(() => save.run?.mode ?? save.lastMode);
  // An unfinished run (app closed mid-game) resumes where it was left.
  const [screen, setScreen] = useState<Screen>(() => (save.run ? { name: 'game' } : { name: 'home' }));
  const [screenKey, setScreenKey] = useState(0);
  const [exiting, setExiting] = useState(false);

  // Keep the save in a ref so synchronous handlers always see the latest state.
  const saveRef = useRef(save);
  const commit = useCallback((next: SaveData) => {
    saveRef.current = next;
    setSave(next);
  }, []);

  // The game screen keeps showing its last run while it animates the ending.
  const runRef = useRef<ActiveRun | null>(save.run);
  if (save.run) runRef.current = save.run;

  useEffect(() => writeSave(save), [save]);
  useEffect(() => requestPersistence(), []);
  // App updates apply only on the home screen: never mid-game or over a result.
  useEffect(() => setSafeToUpdate(screen.name === 'home'), [screen.name]);

  // Ignore taps while a screen transition is running (prevents double starts).
  const navigating = useRef(false);
  const go = useCallback((next: Screen) => {
    navigating.current = true;
    setExiting(true);
    window.setTimeout(() => {
      setScreen(next);
      setScreenKey((k) => k + 1);
      setExiting(false);
      navigating.current = false;
    }, motionMs(220, 0));
  }, []);

  const changeMode = useCallback(
    (m: Mode) => {
      setMode(m);
      commit({ ...saveRef.current, lastMode: m });
    },
    [commit],
  );

  const start = useCallback(
    (m: Mode) => {
      if (navigating.current) return;
      const next = startRun(saveRef.current, m, rng);
      commit(next);
      runRef.current = next.run;
      setMode(m);
      go({ name: 'game' });
    },
    [commit, go],
  );

  const submit = useCallback(
    (pos: number) => {
      const out = submitAnswer(saveRef.current, pos);
      commit(out.save);
      return out;
    },
    [commit],
  );

  const finish = useCallback((result: RunResult) => go(result.won ? { name: 'victory', result } : { name: 'result', result }), [go]);

  const abandon = useCallback(() => {
    if (navigating.current) return;
    const out = abandonRun(saveRef.current);
    if (!out) return go({ name: 'home' });
    commit(out.save);
    go({ name: 'result', result: out.result });
  }, [commit, go]);

  let content: ReactNode = null;
  if (screen.name === 'home') {
    content = <HomeScreen save={save} mode={mode} onMode={changeMode} onStart={() => start(mode)} />;
  } else if (screen.name === 'game' && runRef.current) {
    content = (
      <GameScreen key={runRef.current.gameNo + runRef.current.mode} run={runRef.current} onSubmit={submit} onFinish={finish} onAbandon={abandon} />
    );
  } else if (screen.name === 'result') {
    content = <ResultScreen result={screen.result} onRetry={() => start(screen.result.mode)} onHome={() => go({ name: 'home' })} />;
  } else if (screen.name === 'victory') {
    content = <VictoryScreen result={screen.result} onRetry={() => start(screen.result.mode)} onHome={() => go({ name: 'home' })} />;
  } else {
    content = <HomeScreen save={save} mode={mode} onMode={changeMode} onStart={() => start(mode)} />;
  }

  return (
    <div className="app">
      <div className={`screen screen--${screen.name} ${exiting ? 'screen-exit' : 'screen-enter'}`} key={screenKey}>
        {content}
      </div>
    </div>
  );
}
