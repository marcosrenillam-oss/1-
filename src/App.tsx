import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameMode } from './engine/difficulty';
import { abandonRun, sanitizeRun, startAdventure, startRun, startTimer, submitAnswer, timeoutRun, type Response, type RunResult } from './engine/game';
import { defaultRng } from './engine/rng';
import { loadSave, requestPersistence, writeSave, type ActiveRun, type Play, type SaveData } from './storage/persistence';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen, type HubTarget } from './screens/HomeScreen';
import { QuestionsScreen } from './screens/QuestionsScreen';
import { InvasionScreen } from './screens/InvasionScreen';
import { finishInvasion } from './invasion/record';
import type { InvasionSnapshot } from './invasion/sim';
import type { Game } from './invasion/types';
import { COLORS } from './engine/core';
import { MapScreen } from './screens/MapScreen';
import { CoreScreen } from './screens/CoreScreen';
import type { CoreState } from './engine/core';
import { ResultScreen } from './screens/ResultScreen';
import { VictoryScreen } from './screens/VictoryScreen';
import { motionMs } from './motion';
import { setSafeToUpdate } from './pwa';

type Screen =
  | { name: 'home' }
  | { name: 'core' }
  | { name: 'questions' }
  | { name: 'invasion' }
  | { name: 'map'; justPassed?: { world: number; level: number } | null }
  | { name: 'game' }
  | { name: 'result'; result: RunResult }
  | { name: 'victory'; result: RunResult };

const rng = defaultRng();

export default function App() {
  const [save, setSave] = useState<SaveData>(() => sanitizeRun(loadSave()));
  const [mode, setMode] = useState<GameMode>(() => save.run?.mode ?? save.lastMode);
  const [play, setPlay] = useState<Play>(() => (save.run ? (save.run.type === 'adventure' ? 'adventure' : save.run.timed ? 'crono' : 'classic') : save.lastPlay === 'crono' ? 'classic' : save.lastPlay));
  // An unfinished run (app closed mid-game) resumes where it was left.
  const [screen, setScreen] = useState<Screen>(() => (save.run ? { name: 'game' } : { name: 'home' }));
  const [screenKey, setScreenKey] = useState(0);
  const [exiting, setExiting] = useState(false);

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

  const changeMode = useCallback((m: GameMode) => {
    setMode(m);
    commit({ ...saveRef.current, lastMode: m });
  }, [commit]);

  const changePlay = useCallback((p: Play) => {
    setPlay(p);
    commit({ ...saveRef.current, lastPlay: p });
  }, [commit]);

  const changeCore = useCallback((c: CoreState) => commit({ ...saveRef.current, core: c }), [commit]);

  const invasionSnapshot = useCallback((s: InvasionSnapshot) => {
    const cur = saveRef.current;
    commit({ ...cur, invasion: { ...cur.invasion, run: s } });
  }, [commit]);
  const invasionFinish = useCallback((g: Game) => {
    const out = finishInvasion(saveRef.current, g);
    commit(out.save);
    return out.result;
  }, [commit]);

  const startGame = useCallback((m: GameMode, p: Play) => {
    if (navigating.current) return;
    if (p === 'adventure') {
      go({ name: 'map' });
      return;
    }
    const next = startRun(saveRef.current, m, rng, p === 'crono');
    commit(next);
    runRef.current = next.run;
    setMode(m);
    setPlay(p);
    go({ name: 'game' });
  }, [commit, go]);

  const playAdventure = useCallback(() => {
    if (navigating.current) return;
    const next = startAdventure(saveRef.current, rng);
    if (!next) return;
    commit(next);
    runRef.current = next.run;
    go({ name: 'game' });
  }, [commit, go]);

  const submit = useCallback((r: Response) => {
    const out = submitAnswer(saveRef.current, r);
    commit(out.save);
    return out;
  }, [commit]);

  const beginTimer = useCallback(() => {
    const next = startTimer(saveRef.current, Date.now());
    if (next !== saveRef.current) commit(next);
  }, [commit]);

  const timeout = useCallback(() => {
    const out = timeoutRun(saveRef.current, Date.now());
    if (!out) return null;
    commit(out.save);
    return out.result;
  }, [commit]);

  const finish = useCallback((result: RunResult) => {
    if (result.type === 'adventure') {
      if (result.worldCleared) go({ name: 'victory', result });
      else go({ name: 'map', justPassed: result.won ? { world: result.world ?? 0, level: result.level ?? 1 } : null });
      return;
    }
    go(result.complete ? { name: 'victory', result } : { name: 'result', result });
  }, [go]);

  const abandon = useCallback(() => {
    if (navigating.current) return;
    const out = abandonRun(saveRef.current);
    if (!out) return go({ name: 'home' });
    commit(out.save);
    go(out.result ? { name: 'result', result: out.result } : { name: 'map' });
  }, [commit, go]);

  let content: ReactNode;
  const home = <HomeScreen save={save} onOpen={(t: HubTarget) => go({ name: t })} />;
  if (screen.name === 'game' && runRef.current) {
    content = (
      <GameScreen
        key={`${runRef.current.gameNo}-${runRef.current.type}`}
        run={runRef.current}
        onSubmit={submit}
        onFinish={finish}
        onAbandon={abandon}
        onStartTimer={beginTimer}
        onTimeout={timeout}
      />
    );
  } else if (screen.name === 'questions') {
    content = <QuestionsScreen save={save} mode={mode} play={play} onMode={changeMode} onPlay={changePlay} onStart={() => startGame(mode, play === 'crono' ? 'classic' : play)} onHome={() => go({ name: 'home' })} />;
  } else if (screen.name === 'invasion') {
    content = (
      <InvasionScreen
        record={save.invasion}
        color={COLORS.find((c) => c.id === save.core.color)?.hex ?? '#c8ff2e'}
        onSnapshot={invasionSnapshot}
        onFinish={invasionFinish}
        onHome={() => go({ name: 'home' })}
      />
    );
  } else if (screen.name === 'core') {
    content = <CoreScreen core={save.core} onChange={changeCore} onHome={() => go({ name: 'home' })} />;
  } else if (screen.name === 'map') {
    content = <MapScreen save={save} justPassed={screen.justPassed} onPlay={playAdventure} onHome={() => go({ name: 'home' })} />;
  } else if (screen.name === 'result') {
    content = <ResultScreen result={screen.result} onRetry={() => startGame(screen.result.mode, screen.result.timed ? 'crono' : 'classic')} onHome={() => go({ name: 'home' })} />;
  } else if (screen.name === 'victory') {
    const r = screen.result;
    content = (
      <VictoryScreen
        result={r}
        onRetry={() => (r.type === 'adventure' ? go({ name: 'map' }) : startGame(r.mode, r.timed ? 'crono' : 'classic'))}
        onHome={() => go({ name: 'home' })}
      />
    );
  } else content = home;

  return (
    <div className="app">
      <div className={`screen screen--${screen.name} ${exiting ? 'screen-exit' : 'screen-enter'}`} key={screenKey}>
        {content}
      </div>
    </div>
  );
}
