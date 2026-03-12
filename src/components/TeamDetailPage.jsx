import { useState, useEffect } from 'react';
import { avgField } from '../utils/stats';
import { useParams, useNavigate } from 'react-router-dom';
import RouteCanvas from './RouteCanvas';
import { FormSection, FieldInput, FieldTextarea, Toggle, MultiToggle, MultiSelectToggle, VolumeInput } from './FormFields';

const FIELD_IMG_SRC = 'https://i.imgur.com/2Y5cLE6.jpeg';
const FIELD_W = 820;
const FIELD_H = 455;
const ROUTE_COLORS = ['#22d3ee', '#f43f5e', '#a3e635', '#fb923c', '#a78bfa'];

// ─── Helper functions defined FIRST ─────────────────────────────────────────────
function Stat({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="detail-stat">
      <span className="detail-stat-label">{label}</span>
      <span className="detail-stat-value">{value}</span>
    </div>
  );
}

// 1. Move the styling logic outside to share it between components
const getBadgeStyle = (val) => {
  if (!val) return { background: 'rgba(100,116,139,0.2)', color: 'var(--text)' };
  const v = val.toString().toLowerCase();
  
  if (v === 'red' || v === 'no') return { background: 'rgba(239,68,68,0.2)', color: '#ef4444' };
  if (v === 'blue') return { background: 'rgba(59,130,246,0.2)', color: '#3b82f6' };
  if (v === 'yes') return { background: 'rgba(34,197,94,0.2)', color: '#22c55e' };
  
  return { background: 'rgba(107, 107, 107, 0.2)', color: '#a1a1a1' };
};

// Single Badge Row
function BadgeRow({ label, value }) {
  return (
    <div className="badge-row">
      <span className="detail-stat-label">{label}</span>
      {value 
        ? <span className="badge" style={getBadgeStyle(value)}>{value}</span>
        : <span className="badge badge-empty">—</span>
      }
    </div>
  );
}

// Multiple Badge Row
function BadgeRows({ label, values = [] }) {
  // 1. CONVERT JSON OBJECT TO ARRAY
  // This takes { "0": "Left Hang" } and turns it into ["Left Hang"]
  const dataArray = values && typeof values === 'object' 
    ? Object.values(values) 
    : [];

  return (
    <div className="badge-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
      <span className="detail-stat-label">{label}</span>
      <div className="badge-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end' }}>
        {dataArray.length > 0 ? (
          dataArray.map((val, index) => (
            <span key={index} className="badge" style={getBadgeStyle(val)}>
              {val}
            </span>
          ))
        ) : (
          <span className="badge badge-empty">—</span>
        )}
      </div>
    </div>
  );}

function AutoRoutesDisplay({ routes, onRouteClick }) {
  const W = 400;
  const H = Math.round(400 * (FIELD_H / FIELD_W));
  const sx = W / FIELD_W;
  const sy = H / FIELD_H;

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span>Auto Routes</span>
        {routes.length > 0 && (
          <span className="badge" style={{ background: 'rgba(100,116,139,0.2)', color: 'var(--text)' }}>
            {routes.length}
          </span>
        )}
      </div>
      <div 
        onClick={() => onRouteClick && onRouteClick()}
        style={{ 
          position: 'relative', 
          borderRadius: 8, 
          border: '1px solid var(--border)', 
          overflow: 'hidden',
          width: '100%',
          aspectRatio: `${FIELD_W}/${FIELD_H}`,
        }}
      >
        <img
          src={FIELD_IMG_SRC}
          alt="Field"
          style={{ 
            display: 'block', 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover',
            opacity: 0.5 
          }}
        />
        <svg 
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {routes.map((path, i) => {
            if (!path || path.length < 2) return null;
            const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
            const d = path
              .map((p, j) => `${j === 0 ? 'M' : 'L'}${(p.x * sx).toFixed(1)},${(p.y * sy).toFixed(1)}`)
              .join(' ');
            return (
              <g key={i}>
                <path d={d} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={(path[0].x * sx).toFixed(1)} cy={(path[0].y * sy).toFixed(1)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function IntakeMechanismDisplay({ intakeMech }) {
  let mechArray = [];
  if (Array.isArray(intakeMech)) {
    mechArray = intakeMech;
  } else if (intakeMech && typeof intakeMech === 'string') {
    mechArray = [intakeMech];
  }
  
  const hasIntake = mechArray.length > 0;
  const hasBothIntake = mechArray.length === 2;
  const defaultBadgeStyle = { background: 'rgba(239,68,68,0.2)', color: '#ef4444' };
  
  return (
    <div className="badge-row" style={{ justifyContent: 'space-between' }}>
      <span className="detail-stat-label">Intake Mechanism</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {hasBothIntake ? (
          <>
            <span className="badge" style={defaultBadgeStyle}>HUMAN PLAYER</span>
            <span className="badge" style={defaultBadgeStyle}>GROUND</span>
          </>
        ) : hasIntake ? (
          mechArray.includes('Human Player') ? (
            <span className="badge" style={defaultBadgeStyle}>HUMAN PLAYER ONLY</span>
          ) : (
            <span className="badge" style={defaultBadgeStyle}>GROUND ONLY</span>
          )
        ) : (
          <span className="badge" style={defaultBadgeStyle}>NONE</span>
        )}
      </div>
    </div>
  );
}

function SpeedCrossingDisplay({ speedCrossing }) {
  const getSpeedColor = (speed) => {
    switch (speed?.toLowerCase()) {
      case 'slow':
        return { bg: 'rgba(239,68,68,0.2)', color: '#ef4444' };
      case 'medium':
        return { bg: 'rgba(249,115,22,0.2)', color: '#f97316' };
      case 'fast':
        return { bg: 'rgba(34,197,94,0.2)', color: '#22c55e' };
      default:
        return { bg: 'rgba(100,116,139,0.2)', color: 'var(--text)' };
    }
  };
  
  if (!speedCrossing) {
    return (
      <div className="badge-row" style={{ justifyContent: 'space-between' }}>
        <span className="detail-stat-label">Speed When Crossing</span>
        <span className="badge badge-empty">—</span>
      </div>
    );
  }
  
  const colors = getSpeedColor(speedCrossing);
  
  return (
    <div className="badge-row" style={{ justifyContent: 'space-between' }}>
      <span className="detail-stat-label">Speed When Crossing</span>
      <span className="badge" style={{ background: colors.bg, color: colors.color }}>
        {speedCrossing.toUpperCase()}
      </span>
    </div>
  );
}

function SpeedDisplay({ speed }) {
  const getSpeedColor = (spd) => {
    switch (spd?.toLowerCase()) {
      case 'slow':
        return { bg: 'rgba(239,68,68,0.2)', color: '#ef4444' };
      case 'medium':
        return { bg: 'rgba(249,115,22,0.2)', color: '#f97316' };
      case 'fast':
        return { bg: 'rgba(34,197,94,0.2)', color: '#22c55e' };
      default:
        return { bg: 'rgba(100,116,139,0.2)', color: 'var(--text)' };
    }
  };
  
  if (!speed) {
    return (
      <div className="badge-row" style={{ justifyContent: 'space-between' }}>
        <span className="detail-stat-label">Speed</span>
        <span className="badge badge-empty">—</span>
      </div>
    );
  }
  
  const colors = getSpeedColor(speed);
  
  return (
    <div className="badge-row" style={{ justifyContent: 'space-between' }}>
      <span className="detail-stat-label">Speed</span>
      <span className="badge" style={{ background: colors.bg, color: colors.color }}>
        {speed.toUpperCase()}
      </span>
    </div>
  );
}

function CrossingPathDisplay({ crossPath, label = 'Cross Path' }) {
  let pathArray = [];
  if (Array.isArray(crossPath)) {
    pathArray = crossPath;
  } else if (crossPath && typeof crossPath === 'string') {
    pathArray = [crossPath];
  }
  
  const hasPath = pathArray.length > 0;
  
  if (!hasPath) {
    return (
      <div className="badge-row" style={{ justifyContent: 'space-between' }}>
        <span className="detail-stat-label">{label}</span>
        <span className="badge badge-empty">—</span>
      </div>
    );
  }
  
  return (
    <div className="badge-row" style={{ justifyContent: 'space-between' }}>
      <span className="detail-stat-label">{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {pathArray.map((path) => (
          <span key={path} className="badge" style={{ background: 'rgba(100,116,139,0.2)', color: 'var(--text)' }}>
            {path.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

function StartingPositionDisplay({ startingPosition }) {
  if (!startingPosition) {
    return (
      <div className="detail-stat">
        <span className="detail-stat-label">Starting Position</span>
        <span className="detail-stat-value">—</span>
      </div>
    );
  }
  
  return (
    <div className="detail-stat">
      <span className="detail-stat-label">Starting Position</span>
      <span className="detail-stat-value">Position {startingPosition}</span>
    </div>
  );
}

function MatchTypeDisplay({ matchType }) {
  if (!matchType) {
    return (
      <div className="detail-stat">
        <span className="detail-stat-label">Match Type</span>
        <span className="detail-stat-value">—</span>
      </div>
    );
  }
  
  return (
    <div className="detail-stat">
      <span className="detail-stat-label">Match Type</span>
      <span className="detail-stat-value">{matchType}</span>
    </div>
  );
}

// Blank form template
const BLANK = {
  Student_ID: "",
    Team_Number: "",
    Match_Type: "Unknown",
    Match_Number: "",
    Alliance: "",
    Overall_Ranking: "",
    Starting_Position: "",
    Accuracy: "",
    Efficency: "",
    Throughput: "",
    Agility: "",
    Storage: "",
    Game_Won: "",
    Auton_Won: "",
    Auto_Actions: {},
    Teleop_Actions: {},
    Auto_Balls: "",
    Teleop_Balls: "",
    Alliance_Score: "",
    Features: {},
    Happenings: {},
};

export default function TeamDetailPage({ team, entries, onBack, onEditEntry, user, onUpdateEntry, onDeleteEntry }) {
  // Use string comparison to handle potential type differences between team numbers
  const navigate = useNavigate();

  const teamEntries = entries.filter((e) => String(e.teamNumber) === String(team.number));
  const latest      = teamEntries[teamEntries.length - 1];

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState(BLANK);
  const [showAllRoutesModal, setShowAllRoutesModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(teamEntries.length - 1);

  // Sync selectedEntryIndex when entries change
  useEffect(() => {
    if (selectedEntryIndex >= teamEntries.length) {
      setSelectedEntryIndex(teamEntries.length - 1);
    }
  }, [teamEntries.length, selectedEntryIndex]);

  // Get the currently selected entry for display
  let currentEntry = teamEntries[selectedEntryIndex] || latest;

  //console.log('Current Entry:', currentEntry);

  const hangMap = {
                  0: "None",
                  1: "Level 1",
                  2: "Level 2",
                  3: "Level 3"
                };

  // Use the map, or default to "Unknown" if the value isn't found
  //console.log("Current Entry Hang Level:", currentEntry);
  if(currentEntry.hangLevel != "None" && currentEntry.hangLevel != "Level 1" && currentEntry.hangLevel != "Level 2" && currentEntry.hangLevel != "Level 3" && currentEntry.hangLevel != "Unknown"){
    currentEntry.hangLevel = hangMap[currentEntry.hangLevel] || "Unknown";
  }


  const avgAuto   = avgField(teamEntries, 'autoFuelScored');
  const avgTeleop = avgField(teamEntries, 'teleopFuelScored');

  const handleEditClick = (entry) => {
    setEditingEntry(entry);
    setEditForm({
      teamName: entry.teamName || '',
      teamNumber: entry.teamNumber || '',
      designDesc: entry.designDesc || '',
      fuelCapacity: entry.fuelCapacity || '',
      startingAlliance: entry.startingAlliance || '',
      startingPosition: entry.startingPosition || '',
      intakeMech: entry.intakeMech || [],
      speed: entry.speed || '',
      speedCrossing: entry.speedCrossing || '',
      autoTracking: entry.autoTracking || '',
      shootMoving: entry.shootMoving || '',
      notes: entry.notes || '',
      photos: entry.photos || [],
      autoRoutes: entry.autoRoutes || [],
      autoIntakeFuel: entry.autoIntakeFuel || '',
      autoIntakeSec: entry.autoIntakeSec || '',
      autoOuttakeFuel: entry.autoOuttakeFuel || '',
      autoOuttakeSec: entry.autoOuttakeSec || '',
      autoFuelScored: entry.autoFuelScored || '',
      leavePoint: entry.leavePoint || '',
      autoClimb: entry.autoClimb || '',
      autoClimbSection: entry.autoClimbSection || '',
      autoClimbLevel: entry.autoClimbLevel || '',
      crossPastHub: entry.crossPastHub || '',
      crossPath: entry.crossPath || [],
      teleopIntakeFuel: entry.teleopIntakeFuel || '',
      teleopIntakeSec: entry.teleopIntakeSec || '',
      teleopOuttakeFuel: entry.teleopOuttakeFuel || '',
      teleopOuttakeSec: entry.teleopOuttakeSec || '',
      teleopFuelScored: entry.teleopFuelScored || '',
      teleopClimb: entry.teleopClimb || '',
      teleopClimbSection: entry.teleopClimbSection || '',
      teleopClimbLevel: entry.teleopClimbLevel || '',
      teleopCrossPath: entry.teleopCrossPath || [],
      teleopCrossPastHub: entry.teleopCrossPastHub || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (onUpdateEntry && editingEntry) {
      const updatedEntry = {
        ...editingEntry,
        ...editForm,
        originalId: editingEntry.id,
        id: Date.now(),
        timestamp: new Date().toISOString(),
        editedBy: user?.name || user?.email || 'Unknown',
        isEdit: true,
      };
      onUpdateEntry(updatedEntry);
      setShowEditModal(false);
      setEditingEntry(null);
    }
  };

  const setEditField = (key) => (val) => {
    setEditForm((f) => ({ ...f, [key]: val }));
  };

  const toggleEditIntake = (opt) => {
    const current = editForm.intakeMech || [];
    const next = current.includes(opt)
      ? current.filter((v) => v !== opt)
      : [...current, opt];
    setEditForm((f) => ({ ...f, intakeMech: next }));
  };

  const handleBack = () => {
    navigate('/entries');
  };

  return (
    <div className="page-content">
      <button className="back-btn" onClick={onBack}>← Back to Teams</button>

      <div className="team-detail-header">
        <div className="team-number-big">{team.number}</div>
        <div>
          <h1>{team.name}</h1>
          <p>{teamEntries.length} scouting entr{teamEntries.length !== 1 ? 'ies' : 'y'} recorded</p>
        </div>
      </div>

      {teamEntries.length > 1 && (
        <div className="entry-selector" style={{ marginBottom: 16 }}>
          <label style={{ marginRight: 12, fontWeight: 500 }}>Viewing Entry:</label>
          <select 
            value={selectedEntryIndex} 
            onChange={(e) => setSelectedEntryIndex(Number(e.target.value))}
            style={{ 
              padding: '8px 12px', 
              borderRadius: 6, 
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text)',
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            {teamEntries.map((entry, idx) => (
              <option key={entry.id} value={idx}>
                {entry.isEdit ? 'EDIT' : 'NEW'} - {new Date(entry.timestamp).toLocaleString()}
              </option>
            ))}
          </select>
        </div>
      )}

      {teamEntries.length === 0 ? (
        <div className="empty-state">No entries recorded for this team yet.</div>
      ) : (
        <>
          <div className="detail-grid">
            {/* General */}
            <div className="detail-card">
              <h3>General</h3>
              {currentEntry.designDesc && <div className="design-desc">{currentEntry.designDesc}</div>}
              {/* <Stat label="Fuel Capacity"     value={currentEntry.fuelCapacity} /> */}
              <BadgeRow label="Alliance" value={currentEntry.alliance} colorMap={{ red: 'danger', blue: 'cyan' }} />
              <StartingPositionDisplay startingPosition={currentEntry.startingPosition} />
              <MatchTypeDisplay matchType={currentEntry.matchType} />
              <Stat label="Match Number"     value={currentEntry.matchNumber} />
              <Stat label="Total Alliance Score" value={currentEntry.allianceScore} />
              <BadgeRow label="Won Game" value={currentEntry.gameWon} colorMap={{ Yes: 'green', No: 'danger' }} />

              {currentEntry.notes && (
                <div className="detail-stat" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <span className="detail-stat-label">Notes</span>
                  <span className="detail-stat-value" style={{ whiteSpace: 'pre-wrap' }}>{currentEntry.notes}</span>
                </div>
              )}
            </div>

            {/* Auto */}
            <div className="detail-card">
              <h3>Autonomous</h3>
              <BadgeRow label="Won Auton" value={currentEntry.autonWon} colorMap={{ Yes: 'green', No: 'danger' }} />
              <Stat label="Predicted Fuel Scored" value={currentEntry.autoBalls} />
              <BadgeRows 
                      label="Actions" 
                      values={currentEntry.autoActions} 
                    />            </div>

            {/* Teleop */}
            <div className="detail-card">
              <h3>TeleOp</h3>
              <Stat label="Predicted Fuel Scored" value={currentEntry.teleopBalls} />
              <BadgeRows 
                      label="Actions" 
                      values={currentEntry.teleopActions} 
                    />
            </div>

            {/* Features */}
            <div className="detail-card">
              <h3>Robot Features and Happenings</h3>
              <BadgeRows 
                      label="Features" 
                      values={currentEntry.features} 
                    />
              <BadgeRow label="Climb" value={currentEntry.hangLevel} colorMap={{ "None": 'danger', "Level 1": 'orange' , "Level 2": 'yellow', "Level 3": 'green'}} />
              <BadgeRows 
                label="Happenings" 
                values={currentEntry.happenings} 
              />
            </div>

            {/* Rankings */}
            <div className="detail-card">
              <h3>Post Match Rankings (Out of 6)</h3>
              <BadgeRow label="Overall Ranking" value={currentEntry.overallRanking} colorMap={{ 0: 'danger', 1: 'green' , 2: 'Level 2', 3: 'Level 3'}} />
              <BadgeRow label="Accuracy" value={currentEntry.accuracy} colorMap={{ 0: 'danger', 1: 'green' , 2: 'Level 2', 3: 'Level 3'}} />
              <BadgeRow label="Efficiency" value={currentEntry.efficiency} colorMap={{ 0: 'danger', 1: 'green' , 2: 'Level 2', 3: 'Level 3'}} />
              <BadgeRow label="Throughput" value={currentEntry.throughput} colorMap={{ 0: 'danger', 1: 'green' , 2: 'Level 2', 3: 'Level 3'}} />
              <BadgeRow label="Agility" value={currentEntry.agility} colorMap={{ 0: 'danger', 1: 'green' , 2: 'Level 2', 3: 'Level 3'}} />
              <BadgeRow label="Storage" value={currentEntry.storage} colorMap={{ 0: 'danger', 1: 'green' , 2: 'Level 2', 3: 'Level 3'}} />
            </div>
          </div>

          {/* Entry Log */}
          <div className="detail-card" style={{ marginTop: 16 }}>
            <h3>Entry Log</h3>
            {[...teamEntries].reverse().map((e, index) => (
              <div key={e.id} className="entry-log-row" style={{ position: 'relative' }}>
                <span className="entry-log-info">
                  <span className={`entry-badge entry-badge_${e.isEdit ? 'EDIT' : 'NEW'}`}>{e.isEdit ? 'EDIT' : 'NEW'}</span>
                  <span className="muted">{new Date(e.timestamp).toLocaleString()}</span>
                  {(e.userName || e.editedBy) && <span className="entry-user">{e.editedBy || e.userName}</span>}
                </span>
              </div>
            ))}
          </div>
          {teamEntries.length > 0 && (
            <button 
              className="edit-entry-btn" 
              onClick={() => handleEditClick(currentEntry)}
              title="Edit Current Entry"
              style={{ 
                position: 'fixed', 
                bottom: 30, 
                right: 30, 
                zIndex: 100,
                width: 56, 
                height: 56, 
                borderRadius: '50%', 
                background: 'var(--accent)', 
                border: '1px solid var(--accent)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          )}
        </>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>Edit Entry</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <FormSection title="Match Information">
                <div className="field">
                  <label>Team <span className="req">*</span></label>
                  <div style={{ padding: '8px 0', color: 'var(--text)' }}>
                    {editForm.teamNumber}
                  </div>
                </div>

                <MultiToggle
                  label="Match Type"
                  required
                  options={['Practice', 'Qualifier', 'Final']}
                  value={editForm.matchType}
                  onChange={setEditField('matchType')}
                />
                <FieldInput
                  label="Match Number"
                  required
                  type="number"
                  value={editForm.matchNumber}
                  onChange={setEditField('match_Number')}
                  placeholder="e.g. 1"
                  min="1"
                />
                <MultiToggle
                  label="Alliance"
                  required
                  options={['Red', 'Blue', 'Final']}
                  value={editForm.alliance}
                  onChange={setEditField('alliance')}
                />
                <MultiToggle
                  label="Starting Position"
                  required
                  options={['1', '2', '3']}
                  value={editForm.startingPosition}
                  onChange={setEditField('startingPosition')}
                />
              </FormSection>

              <FormSection title="Autonomous">
                <MultiSelectToggle
                  label="Auto"
                  required
                  options={['Human Player', 'Ground Intake']}
                  value={editForm.intakeMech || []}
                  onChange={setEditField('intakeMech')}
                />

                <VolumeInput
                  label="Intaking Volume (fuel / sec)"
                  required
                  fuelVal={editForm.autoIntakeFuel} secVal={editForm.autoIntakeSec}
                  onFuelChange={setEditField('autoIntakeFuel')} onSecChange={setEditField('autoIntakeSec')}
                />
                <VolumeInput
                  label="Outtaking Volume (fuel / sec)"
                  required
                  fuelVal={editForm.autoOuttakeFuel} secVal={editForm.autoOuttakeSec}
                  onFuelChange={setEditField('autoOuttakeFuel')} onSecChange={setEditField('autoOuttakeSec')}
                />
                <FieldInput
                  label="Predicted Fuel Scored"
                  required
                  type="number"
                  value={editForm.autoFuelScored}
                  onChange={setEditField('autoFuelScored')}
                  min="0"
                />

                <Toggle label="Leave Point?" required value={editForm.leavePoint} onChange={setEditField('leavePoint')} />
                <Toggle label="Climb?" required value={editForm.autoClimb} onChange={setEditField('autoClimb')} />
                {editForm.autoClimb === 'yes' && (
                  <div className="nested-options">
                    <MultiToggle label="Climb Section" required options={['Left', 'Center', 'Right']} value={editForm.autoClimbSection} onChange={setEditField('autoClimbSection')} />
                    <MultiToggle label="Climb Level" required options={['Level 1', 'Level 2', 'Level 3']} value={editForm.autoClimbLevel} onChange={setEditField('autoClimbLevel')} />
                  </div>
                )}

                <Toggle label="Cross Past Hub?" required value={editForm.crossPastHub} onChange={setEditField('crossPastHub')} />
                {editForm.crossPastHub === 'yes' && (
                  <div className="nested-options">
                    <MultiSelectToggle
                      label="Cross Path"
                      required
                      options={['Left Bump', 'Right Bump', 'Left Trench', 'Right Trench']}
                      value={editForm.crossPath || []}
                      onChange={setEditField('crossPath')}
                    />
                  </div>
                )}
              </FormSection>

              <FormSection title="Teleop">
                <VolumeInput
                  label="Intaking Volume (fuel / sec)"
                  required
                  fuelVal={editForm.teleopIntakeFuel} secVal={editForm.teleopIntakeSec}
                  onFuelChange={setEditField('teleopIntakeFuel')} onSecChange={setEditField('teleopIntakeSec')}
                />
                <VolumeInput
                  label="Outtaking Volume (fuel / sec)"
                  required
                  fuelVal={editForm.teleopOuttakeFuel} secVal={editForm.teleopOuttakeSec}
                  onFuelChange={setEditField('teleopOuttakeFuel')} onSecChange={setEditField('teleopOuttakeSec')}
                />
                <FieldInput
                  label="Predicted Fuel Scored"
                  required
                  type="number"
                  value={editForm.teleopFuelScored}
                  onChange={setEditField('teleopFuelScored')}
                  min="0"
                />

                <Toggle label="Climb?" required value={editForm.teleopClimb} onChange={setEditField('teleopClimb')} />
                {editForm.teleopClimb === 'yes' && (
                  <div className="nested-options">
                    <MultiToggle label="Climb Section" required options={['Left', 'Center', 'Right']} value={editForm.teleopClimbSection} onChange={setEditField('teleopClimbSection')} />
                    <MultiToggle label="Climb Level" required options={['Level 1', 'Level 2', 'Level 3']} value={editForm.teleopClimbLevel} onChange={setEditField('teleopClimbLevel')} />
                  </div>
                )}

                <Toggle label="Cross Past Hub?" required value={editForm.teleopCrossPastHub} onChange={setEditField('teleopCrossPastHub')} />
                {editForm.teleopCrossPastHub === 'yes' && (
                  <div className="nested-options">
                    <MultiSelectToggle
                      label="Cross Path"
                      required
                      options={['Left Bump', 'Right Bump', 'Left Trench', 'Right Trench']}
                      value={editForm.teleopCrossPath || []}
                      onChange={setEditField('teleopCrossPath')}
                    />
                  </div>
                )}
              </FormSection>

              <FormSection title="Notes">
                <FieldTextarea
                  label="Additional Notes"
                  required
                  value={editForm.notes}
                  onChange={setEditField('notes')}
                  placeholder="Any additional observations, strategy notes, robot characteristics..."
                  rows={4}
                />
              </FormSection>
            </div>
            <div className="modal-footer">
              <button className="delete-btn" onClick={() => setShowDeleteConfirm(true)}>Delete Entry</button>
              <button className="cancel-btn" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="save-btn" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2>Delete Entry</h2>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ marginBottom: 20 }}>
                Are you sure you want to delete this entry? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button 
                  className="cancel-btn" 
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  className="delete-btn" 
                  onClick={() => {
                    onDeleteEntry && onDeleteEntry(editingEntry.id);
                    setShowDeleteConfirm(false);
                    setShowEditModal(false);
                    handleBack();
                  }}
                  style={{ flex: 1 }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Routes Modal - shows all routes at once */}
      {showAllRoutesModal && currentEntry?.autoRoutes && (() => {
        // Handle both array and object formats
        let routesArray = [];
        if (Array.isArray(currentEntry.autoRoutes)) {
          routesArray = currentEntry.autoRoutes;
        } else if (currentEntry.autoRoutes && typeof currentEntry.autoRoutes === 'object') {
          routesArray = Object.values(currentEntry.autoRoutes).filter(Array.isArray);
        }
        return routesArray.length > 0;
      })() && (
        <div className="modal-overlay" onClick={() => setShowAllRoutesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', padding: 20, background: 'var(--card-bg)' }}>
            <div className="modal-header">
              <h2>All Auto Routes</h2>
              <button className="modal-close" onClick={() => setShowAllRoutesModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px 0' }}>
              <div style={{ position: 'relative', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', width: '100%', aspectRatio: `${FIELD_W}/${FIELD_H}` }}>
                <img
                  src={FIELD_IMG_SRC}
                  alt="Field"
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }}
                />
                <svg width="100%" height="100%" viewBox={`0 0 ${400} ${Math.round(400 * (FIELD_H / FIELD_W))}`} style={{ position: 'absolute', top: 0, left: 0 }}>
                  {(() => {
                    const W = 400;
                    const H = Math.round(400 * (FIELD_H / FIELD_W));
                    const sx = W / FIELD_W;
                    const sy = H / FIELD_H;
                    let routesArray = [];
                    if (Array.isArray(currentEntry.autoRoutes)) {
                      routesArray = currentEntry.autoRoutes;
                    } else if (currentEntry.autoRoutes && typeof currentEntry.autoRoutes === 'object') {
                      routesArray = Object.values(currentEntry.autoRoutes).filter(Array.isArray);
                    }
                    return routesArray.map((path, i) => {
                      if (!path || path.length < 2) return null;
                      const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
                      const d = path.map((p, j) => `${j === 0 ? 'M' : 'L'}${(p.x * sx).toFixed(1)},${(p.y * sy).toFixed(1)}`).join(' ');
                      return (
                        <g key={i}>
                          <path d={d} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx={(path[0].x * sx).toFixed(1)} cy={(path[0].y * sy).toFixed(1)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
                        </g>
                      );
                    });
                  })()}
                </svg>
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(() => {
                  let routesArray = [];
                  if (Array.isArray(currentEntry.autoRoutes)) {
                    routesArray = currentEntry.autoRoutes;
                  } else if (currentEntry.autoRoutes && typeof currentEntry.autoRoutes === 'object') {
                    routesArray = Object.values(currentEntry.autoRoutes).filter(Array.isArray);
                  }
                  return routesArray.map((path, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, background: 'rgba(100,116,139,0.2)', fontSize: 12 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: ROUTE_COLORS[i % ROUTE_COLORS.length] }}></span>
                      Route {i + 1}
                    </span>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

