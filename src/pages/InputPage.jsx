import { useState, useEffect, useRef } from 'react';
import {
  FormSection, FieldInput, FieldTextarea,
  Toggle, MultiToggle, MultiSelectToggle
} from '../components/FormFields';
import { processOMRScans } from '../utils/scanner.js';
import mapJson from '../data/map.json';
import '../styles/scanner.css'; // (Change this to '../App.css' if that's what your file is named!)

// 1. Updated BLANK state to perfectly match your Scanner output
const BLANK = {
  teamName: '', teamNumber: '',
  studentId: '', matchType: '', matchNumber: '',
  alliance: '', startingPosition: '',
  
  autoBalls: '', autonWon: '',
  autoActions: [], 

  teleopBalls: '', 
  teleopActions: [],

  allianceScore: '', gameWon: '',
  overallRanking: '', accuracy: '', efficiency: '',
  throughput: '', agility: '', storage: '',

  features: [], hangLevel: '',
  happenings: [], notes: ''
};

export default function InputPage({onSubmit, showToast, user }) {
  const [form, setForm]             = useState(BLANK);
  const [submitted, setSubmitted]   = useState(false);
  const [uploading, setUploading]   = useState(false);

  // --- Scanner Staging State ---
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const cvFileInputRef = useRef(null);
  const [scanUiOpen, setScanUiOpen] = useState(false);
  const [scanFile, setScanFile] = useState(null);
  // Load initial value from local storage, or default to 0.011
  // 1. Load the value immediately when the component starts
  const [fillRatio, setFillRatio] = useState(() => {
    const saved = localStorage.getItem('omr_fill_ratio');
    const initialValue = saved ? parseFloat(saved) : 0.011;
    //console.log("Loading slider from storage:", initialValue);
    return initialValue;
  });

  // 2. This effect runs every time fillRatio changes to keep LocalStorage in sync
  useEffect(() => {
    localStorage.setItem('omr_fill_ratio', fillRatio.toString());
    //console.log("Saving slider to storage:", fillRatio);
  }, [fillRatio]);
  const [rawScanData, setRawScanData] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);

  // Check OpenCV loaded
  useEffect(() => {
    const checkOpenCvReady = () => {
      if (window.cv && window.cv.Mat) {
        setIsCvLoaded(true);
        return true;
      }
      return false;
    };
    if (checkOpenCvReady()) return;
    const intervalId = setInterval(() => {
      if (checkOpenCvReady()) clearInterval(intervalId);
    }, 100);
    return () => clearInterval(intervalId);
  }, []);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  // --- Scanner Logic ---
  const handleCvButtonClick = () => {
    if (cvFileInputRef.current) cvFileInputRef.current.click();
  };

  const handleCvFileChange = (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      const file = files[0];
      setScanFile(file);
      //setFillRatio(0.011); 
      setScanUiOpen(true);
      setShowCanvas(false);
      setRawScanData(null);
      
      // Allow UI to render the container before scanning
      setTimeout(() => runScanForFile(file), 50);
    }
    event.target.value = ''; 
  };

  const runScanForFile = async (file) => {
    setIsScanning(true);
    try {
      const container = document.getElementById('cvOutputContainer');
      if (container) container.innerHTML = ''; // Clear previous canvas

      // CHANGE THIS LINE: Pass mapJson directly instead of a path string
      const results = await processOMRScans(mapJson, [file], 'cvOutputContainer', fillRatio);
      
      const scan = results[0]; 

      if (scan._Error) throw new Error(scan._Error);
      setRawScanData(scan);
    } catch (error) {
      console.error("Scanner failed:", error);
      showToast("Failed to process scan. Check console.", "error");
    } finally {
      setIsScanning(false);
    }
  };

  const handleRatioSliderRelease = () => {
    if (scanFile) runScanForFile(scanFile);
  };

  // --- Map Scanner Data to React Form ---
  const applyScanDataToForm = () => {
    if (!rawScanData) return;
    const scan = rawScanData;

    const cleanKey = (key) => key.replace(/_/g, ' ');

  const autoActionsArr = Object.keys(scan.Auto_Actions || {})
    .filter(k => scan.Auto_Actions[k] === "Yes")
    .map(cleanKey); // Convert underscores to spaces

  const teleopActionsArr = Object.keys(scan.Teleop_Actions || {})
    .filter(k => scan.Teleop_Actions[k] === "Yes")
    .map(cleanKey); // Convert underscores to spaces

  const happeningsArr = Object.keys(scan.Happenings || {})
    .filter(k => scan.Happenings[k] === "Yes")
    .map(cleanKey);

  // Repeat for features if needed
  const featuresArr = Object.keys(scan.Features || {})
    .filter(k => scan.Features[k] === "Yes" && k !== "Hang")
    .map(cleanKey);

    console.log ("Raw features Data:", scan.Features);
    console.log ("Raw happenings Data:", scan.Happenings);

    // NEW: Safely grab Starting Position (handles both String and Object formats)
    let parsedStartPos = '';
    if (typeof scan.Starting_Position === 'object') {
      parsedStartPos = Object.keys(scan.Starting_Position || {}).find(k => scan.Starting_Position[k] === "Yes") || '';
    } else {
      parsedStartPos = String(scan.Starting_Position || '');
    }

    setForm(prev => ({
      ...prev,
      studentId: String(scan.Student_ID || ''),
      teamNumber: String(scan.Team_Number || ''),
      matchType: scan.Match_Type !== "None" ? scan.Match_Type : '',
      matchNumber: String(scan.Match_Number || ''),
      alliance: scan.Alliance !== "None" ? scan.Alliance : '',
      
      // Update this line to use our new parsed variable:
      startingPosition: parsedStartPos,
      
      autoBalls: String(scan.Auto_Balls || ''),
      // ... rest of the mappings stay the same
      autoActions: autoActionsArr,
      autonWon: scan.Auton_Won === "Yes" ? "yes" : "no",

      teleopBalls: String(scan.Teleop_Balls || ''),
      teleopActions: teleopActionsArr,

      allianceScore: String(scan.Alliance_Score || ''),
      gameWon: scan.Game_Won === "Yes" ? "yes" : "no",
      overallRanking: String(scan.Overall_Ranking || ''),
      accuracy: String(scan.Accuracy || ''),
      efficiency: String(scan.Efficency || ''), 
      throughput: String(scan.Throughput || ''),
      agility: String(scan.Agility || ''),
      storage: String(scan.Storage || ''),

      features: featuresArr,
      hangLevel: String(scan.Features?.Hang || ''),
      happenings: happeningsArr,
    }));

    showToast("Form filled successfully!", "success");
    setScanUiOpen(false); 
  };

  const handleSubmit = async () => {
    if (!form.teamNumber) { showToast('Please enter a team number.', 'warning'); return; }
    if (!form.matchNumber) { showToast('Please enter a match number.', 'warning'); return; }

    setUploading(true);
    const userName = user?.name || user?.email || 'Unknown';
    onSubmit({ ...form, id: Date.now(), timestamp: new Date().toISOString(), userName: userName });
    setForm(BLANK);
    setSubmitted(true);
    setUploading(false);
    setTimeout(() => setSubmitted(false), 3500);
  };

  const actionOptions = ['Ground Intake', 'Human Player Intake', 'Bump', 'Trench', 'Shoot To Area', 'Dump In Area', 'Left Hang', 'Center Hang', 'Right Hang'];
  const ratingOptions = ['1', '2', '3', '4', '5','6'];

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Scout Entry</h1>
        <p>Scan a sheet or manually fill out the observation</p>

        {/* --- OpenCV Scanner Trigger --- */}
        <div style={{ marginTop: '1rem' }}>
          <input
            type="file"
            ref={cvFileInputRef}
            onChange={handleCvFileChange}
            accept="image/*, application/pdf"
            style={{ display: 'none' }} 
          />
          <button
            type="button"
            onClick={handleCvButtonClick}
            disabled={!isCvLoaded}
            className="scan-upload-btn"
          >
            {!isCvLoaded ? 'Loading Scanner...' : 'Upload Sheet to Auto-Fill'}
          </button>
        </div>

        {/* --- Scanner Settings & Preview Box --- */}
        {scanUiOpen && (
          <div className="scan-review-box">
            <div className="scan-review-header">
              <h3>Review Scan ({scanFile?.name})</h3>
              <button onClick={() => setScanUiOpen(false)} className="scan-close-btn">
                ✕ Close
              </button>
            </div>

            <div>
              <label className="scan-slider-label">
                Fill Ratio Threshold: <span>{fillRatio.toFixed(3)}</span>
                <div className="scan-slider-desc">
                  If empty bubbles are being marked full, increase this. If filled bubbles are being missed, decrease it.
                </div>
              </label>
              <input 
                type="range" 
                min="0.005" max="0.50" step="0.001" 
                value={fillRatio} 
                onChange={(e) => setFillRatio(parseFloat(e.target.value))}
                onMouseUp={handleRatioSliderRelease} 
                onTouchEnd={handleRatioSliderRelease}
                className="scan-slider"
              />
            </div>

            <div className="scan-canvas-wrapper">
              <button onClick={() => setShowCanvas(!showCanvas)} className="scan-toggle-btn">
                {showCanvas ? '▼ Hide Visual Output' : '▶ Show Visual Output'}
              </button>
              
              {/* Output Container for OpenCV */}
              <div 
                id="cvOutputContainer" 
                style={{ 
                  display: showCanvas ? 'block' : 'none', 
                  padding: '10px', 
                  backgroundColor: 'var(--surface)', 
                  overflowX: 'auto', 
                  textAlign: 'center' 
                }} 
              />
            </div>

            <button
              onClick={applyScanDataToForm}
              disabled={isScanning || !rawScanData}
              className="scan-accept-btn"
            >
              {isScanning ? 'Scanning...' : 'Accept Scan & Fill Form'}
            </button>
          </div>
        )}
      </div>

      {submitted && <div className="success-toast"><span>Entry submitted successfully!</span></div>}
      {uploading && <div className="uploading-overlay"><span>Submitting...</span></div>}
      
      {/* ... Form Sections below stay exactly the same ... */}

      {/* ── Form Fields ─────────────────────────────────────────────────────────── */}
      <FormSection title="Match Information">
        <FieldInput label="Student ID" type="number" value={form.studentId} onChange={set('studentId')} />
        <FieldInput label="Team Number" required type="number" value={form.teamNumber} onChange={set('teamNumber')} />
        
        <MultiToggle label="Match Type" options={['Practice', 'Qualifier', 'Final']} value={form.matchType} onChange={set('matchType')} />
        <FieldInput label="Match Number" required type="number" value={form.matchNumber} onChange={set('matchNumber')} />
        
        <MultiToggle label="Alliance" options={['Red', 'Blue']} value={form.alliance} onChange={set('alliance')} />
        <MultiToggle label="Starting Position" options={['1', '2', '3']} value={form.startingPosition} onChange={set('startingPosition')} />      </FormSection>

      <FormSection title="Autonomous">
        <FieldInput label="Auto Balls Scored" type="number" value={form.autoBalls} onChange={set('autoBalls')} />
        <MultiSelectToggle label="Auto Actions Taken" options={actionOptions} value={form.autoActions} onChange={set('autoActions')} />
        <Toggle label="Auton Won?" value={form.autonWon} onChange={set('autonWon')} />
      </FormSection>

      <FormSection title="Teleop">
        <FieldInput label="Teleop Balls Scored" type="number" value={form.teleopBalls} onChange={set('teleopBalls')} />
        <MultiSelectToggle label="Teleop Actions Taken" options={actionOptions} value={form.teleopActions} onChange={set('teleopActions')} />
      </FormSection>

      <FormSection title="Robot Features & Happenings">
        <MultiSelectToggle label="Features" options={['Auto Aim', 'Turret', 'Dual/Drum', 'Expaning']} value={form.features} onChange={set('features')} />
        <FieldInput label="Hang Level" type="number" value={form.hangLevel} onChange={set('hangLevel')} placeholder="0 for none" />
        <MultiSelectToggle label="Happenings" options={['Beached', 'Electrical', 'Disabled', 'Penalty', 'No Show']} value={form.happenings} onChange={set('happenings')} />
      </FormSection>

      <FormSection title="Post-Match Ratings (1-6)">
        <FieldInput label="Alliance Score" type="number" value={form.allianceScore} onChange={set('allianceScore')} />
        <Toggle label="Game Won?" value={form.gameWon} onChange={set('gameWon')} />
        
        <MultiToggle label="Overall Ranking" options={ratingOptions} value={form.overallRanking} onChange={set('overallRanking')} />
        <MultiToggle label="Accuracy" options={ratingOptions} value={form.accuracy} onChange={set('accuracy')} />
        <MultiToggle label="Efficiency" options={ratingOptions} value={form.efficiency} onChange={set('efficiency')} />
        <MultiToggle label="Throughput" options={ratingOptions} value={form.throughput} onChange={set('throughput')} />
        <MultiToggle label="Agility" options={ratingOptions} value={form.agility} onChange={set('agility')} />
        <MultiToggle label="Storage" options={ratingOptions} value={form.storage} onChange={set('storage')} />
      </FormSection>

      <FormSection title="Notes">
        <FieldTextarea label="Additional Notes" value={form.notes} onChange={set('notes')} placeholder="Any other observations..." rows={4} />
      </FormSection>

      <div className="form-actions">
        <button className="submit-btn" onClick={handleSubmit} disabled={uploading}>
          {uploading ? 'Submitting...' : 'Submit Entry'}
        </button>
      </div>
    </div>
  );
}