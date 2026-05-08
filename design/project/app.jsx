// BenchPilot — main app: design canvas wiring all screens.

const root = ReactDOM.createRoot(document.getElementById('root'));

// Standard phone artboard size — matches PhoneFrame
const PW = 375, PH = 812;

function App() {
  return (
    <DesignCanvas minScale={0.15} maxScale={2.5}>
      <DCSection
        id="hero"
        title="Active Workout — the hero"
        subtitle="Where you spend most of your gym time. Numbers are the loudest thing on the screen."
      >
        <DCArtboard id="amrap-idle" label="AMRAP · ready" width={PW} height={PH}>
          <WorkoutAMRAPScreen variant="idle" />
        </DCArtboard>
        <DCArtboard id="amrap-plates" label="AMRAP · plate calc expanded" width={PW} height={PH}>
          <WorkoutAMRAPScreen variant="idle" expandPlates={true} />
        </DCArtboard>
        <DCArtboard id="amrap-logged" label="AMRAP · logged + rest banner" width={PW} height={PH}>
          <WorkoutAMRAPScreen variant="logged" prefillReps={13} />
        </DCArtboard>
        <DCArtboard id="standard" label="Working set · Set 3 of 5" width={PW} height={PH}>
          <WorkoutStandardScreen setNum={3} />
        </DCArtboard>
        <DCArtboard id="rest-fullscreen" label="Rest timer · full-screen" width={PW} height={PH}>
          <RestTimerScreen />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="flow-set"
        title="Flow · log set → rest → next set"
        subtitle="Three sequential states of the standard working-set screen."
      >
        <DCArtboard id="flow1" label="1 · Set 3 ready" width={PW} height={PH}>
          <WorkoutStandardScreen setNum={3} prefilledReps={5} />
        </DCArtboard>
        <DCArtboard id="flow2" label="2 · Set 3 logged · resting" width={PW} height={PH}>
          <WorkoutStandardScreen setNum={3} prefilledReps={5} variant="logged" />
        </DCArtboard>
        <DCArtboard id="flow3" label="3 · Set 4 queued" width={PW} height={PH}>
          <WorkoutStandardScreen setNum={4} prefilledReps={5} />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="flow-amrap"
        title="Flow · AMRAP → TM bump → updated dashboard"
      >
        <DCArtboard id="amrap1" label="1 · AMRAP · 13 reps logged" width={PW} height={PH}>
          <WorkoutAMRAPScreen variant="idle" prefillReps={13} />
        </DCArtboard>
        <DCArtboard id="amrap2" label="2 · TM bump modal" width={PW} height={PH}>
          <AMRAPBumpModal />
        </DCArtboard>
        <DCArtboard id="amrap3" label="3 · Dashboard · new TM" width={PW} height={PH}>
          <DashboardScreen benchTM={295} benchSub="bumped just now · +10 lb" highlight={true} />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="home"
        title="Home & Auth"
        subtitle="The dashboard is the landing screen after sign-in."
      >
        <DCArtboard id="signin" label="Sign-in · password only" width={PW} height={PH}>
          <SignInScreen />
        </DCArtboard>
        <DCArtboard id="dashboard" label="Dashboard · default" width={PW} height={PH}>
          <DashboardScreen />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="program"
        title="Program & Preview"
        subtitle="14-week block · tap a day to preview the session."
      >
        <DCArtboard id="program-cal" label="Program · 14-week calendar" width={PW} height={PH}>
          <ProgramScreen />
        </DCArtboard>
        <DCArtboard id="preview" label="Workout preview · Upper A" width={PW} height={PH}>
          <WorkoutPreviewScreen />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="lifts"
        title="Lifts & TM history"
      >
        <DCArtboard id="lifts-bench" label="Lifts · Bench tab" width={PW} height={PH}>
          <LiftsScreen />
        </DCArtboard>
        <DCArtboard id="manual-tm" label="Manual TM · confirmation" width={PW} height={PH}>
          <ManualTMDialog />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="settings"
        title="Settings"
      >
        <DCArtboard id="settings" label="Settings · main" width={PW} height={PH}>
          <SettingsScreen />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

root.render(<App />);
