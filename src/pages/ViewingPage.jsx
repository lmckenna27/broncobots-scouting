import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TeamDetailPage from '../components/TeamDetailPage';
import { avgField } from '../utils/stats';

export default function ViewingPage({ teams, entries, user, updateEntry, deleteEntry }) {
  const { teamNumber } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // If teamNumber is in URL, show that team's detail
  // Use string comparison to handle potential type differences
  const selectedTeam = teamNumber 
    ? teams.find((t) => String(t.number) === String(teamNumber))
    : null;

  const teamStats = teams.map((team) => {
    const te = entries.filter((e) => String(e.teamNumber) === String(team.number));
    const lastEntry = te[te.length - 1];
    return {
      ...team,
      entryCount: te.length,
      lastEntry,
      avgAuto:   avgField(te, 'autoFuelScored'),
      avgTeleop: avgField(te, 'teleopFuelScored'),
    };
  });

  const filtered = teamStats
    .filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.number.includes(search)
    )
    .sort((a, b) => b.entryCount - a.entryCount);

  const handleTeamClick = (team) => {
    navigate(`/entries/${team.number}`);
  };

  const handleBack = () => {
    navigate('/entries');
  };

  if (selectedTeam) {
    const teamEntries = entries.filter((e) => String(e.teamNumber) === String(selectedTeam.number));
    return (
      <TeamDetailPage
        team={selectedTeam}
        entries={teamEntries}
        onBack={handleBack}
        user={user}
        onUpdateEntry={updateEntry}
        onDeleteEntry={deleteEntry}
      />
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Scouting Entries</h1>
        <div className="page-live-indicator">
          <div className="live-dot" />
          Live
        </div>
      </div>

      <div className="search-bar">
        <input
          placeholder="Search by team number or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          No teams added yet. Ask your admin to configure teams on the Config page.
        </div>
      )}

      <div className="team-grid">
        {filtered.map((team) => (
          <TeamCard
            key={team.number}
            team={team}
            onClick={() => handleTeamClick(team)}
          />
        ))}
      </div>
    </div>
  );
}

function TeamCard({ team, onClick }) {
  // Get alliance color and position from last entry
  const allianceColor = team.lastEntry?.startingAlliance || '';
  const positionNum = team.lastEntry?.startingPosition || '';
  //console.log('Rendering TeamCard for team', team.lastEntry);

  return (
    <div
      className={`team-card ${team.entryCount === 0 ? 'team-card-empty' : ''}`}
      onClick={onClick}
    >
      <div className="team-card-number">{team.number}</div>
      <div className="team-card-name">{team.name}</div>

      {team.entryCount > 0 ? (
        <>
          <div className="team-card-entries">
            {team.entryCount} {team.entryCount !== 1 ? 'entries' : 'entry'}
          </div>
          
          {/* Alliance color and position */}
          {(allianceColor || positionNum) && (
            <div className="team-card-alliance-pos">
              {allianceColor && (
                <span className={`alliance-badge alliance-${allianceColor.toLowerCase()}`}>
                  {allianceColor}
                </span>
              )}
              {positionNum && (
                <span className="position-badge">
                  POSITION {positionNum}
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="team-card-entries muted">No entries yet</div>
      )}

      <div className="team-card-arrow">→</div>
    </div>
  );
}

