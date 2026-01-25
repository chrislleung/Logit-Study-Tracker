import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
  BarChart, Bar, Legend
} from 'recharts';
import './App.css';
import { db } from './db'; // Import the local database

// --- Optimized Image Component ---
const OptimizedImage = React.memo(({ src, size, side, spacing }) => {
    if (!src) return <div style={{width: `${size}px`}}></div>; 
    return (
        <img 
            src={src} 
            alt={`${side}-decoration`} 
            style={{
                height: `${size}px`, 
                borderRadius: '8px', 
                maxWidth: '100%', 
                objectFit: 'contain',
                display: 'block'
            }} 
        />
    );
});

function App() {
  // --- Global State ---
  const [semesters, setSemesters] = useState([]);
  const [activeSemesterId, setActiveSemesterId] = useState(null);
  const [prevSemesterId, setPrevSemesterId] = useState(null);
  
  // Persistence for class selection
  const selectionsRef = useRef({}); 

  const [newSemesterName, setNewSemesterName] = useState("");
  const [viewingArchived, setViewingArchived] = useState(false);
  const [openTabMenu, setOpenTabMenu] = useState(null);

  // --- View State ---
  const [activeView, setActiveView] = useState('tracker'); 
  const [currentDate, setCurrentDate] = useState(new Date()); 

  // --- Theme State ---
  const [primaryColor, setPrimaryColor] = useState(localStorage.getItem('studyTrackerColor') || '#61dafb');
  const [accentColor, setAccentColor] = useState(localStorage.getItem('studyTrackerAccent') || '#61dafb');
  const [backgroundColor, setBackgroundColor] = useState(localStorage.getItem('studyTrackerBg') || '#282c34');
  const [textColor, setTextColor] = useState(localStorage.getItem('studyTrackerText') || '#ffffff');
  
  const [leftGif, setLeftGif] = useState(localStorage.getItem('studyTrackerLeftGif') || null);
  const [rightGif, setRightGif] = useState(localStorage.getItem('studyTrackerRightGif') || null);

  const [gifSize, setGifSize] = useState(localStorage.getItem('studyTrackerGifSize') || 100);
  const [gifSpacing, setGifSpacing] = useState(localStorage.getItem('studyTrackerGifSpacing') || 20);

  const [showSettings, setShowSettings] = useState(false);

  // --- Modal State ---
  const [modalConfig, setModalConfig] = useState({
      isOpen: false,
      title: "",
      message: "",
      type: "alert", 
      onConfirm: null
  });

  // --- Editing State ---
  const [editingSemesterId, setEditingSemesterId] = useState(null);
  const [tempSemesterName, setTempSemesterName] = useState("");

  // --- Timer & Session State ---
  const [isStudying, setIsStudying] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessionTag, setSessionTag] = useState(""); 
  
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  
  // --- Log Management State ---
  const [showLogForm, setShowLogForm] = useState(false);
  const [logFormData, setLogFormData] = useState({ id: null, subject: "", tag: "", startTime: "", endTime: "" });
  
  // --- Selection State ---
  const [selectedSubject, setSelectedSubject] = useState(""); 
  const [selectedSubjectId, setSelectedSubjectId] = useState(""); 
  
  const [newSubjectName, setNewSubjectName] = useState("");
  const [showManageClasses, setShowManageClasses] = useState(false);

  // --- Assessments State ---
  const [assessments, setAssessments] = useState([]);
  const [newAssessment, setNewAssessment] = useState({ name: "", type: "", date: "", grade: "" });
  const [showAddAssessment, setShowAddAssessment] = useState(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  const [editAssessmentData, setEditAssessmentData] = useState({ name: "", type: "", date: "", grade: "" });
  const [openAssessmentMenu, setOpenAssessmentMenu] = useState(null);

  // --- Grade Calculator & Custom Types State ---
  const [gradeEntries, setGradeEntries] = useState([]);
  const [assignmentTypes, setAssignmentTypes] = useState([]); 
  const [weights, setWeights] = useState({});
  const [remainingItems, setRemainingItems] = useState({}); // Qty Left

  const [newGradeEntry, setNewGradeEntry] = useState({ name: "", score: "", totalPoints: "100", category: "" });
  const [targetGrade, setTargetGrade] = useState(90);
  const [newTypeName, setNewTypeName] = useState("");
  const [showAbsolute, setShowAbsolute] = useState(false); 

  // --- Filter & Manager Visibility State ---
  const [visibleTypes, setVisibleTypes] = useState({});
  const [showTypeManager, setShowTypeManager] = useState(false);

  // --- Editing State for Calculator List ---
  const [editingGradeId, setEditingGradeId] = useState(null);
  const [editingGradeType, setEditingGradeType] = useState(null); 
  const [editGradeData, setEditGradeData] = useState({ name: "", score: "", totalPoints: "", category: "" });

  // --- Type Renaming State ---
  const [openTypeMenu, setOpenTypeMenu] = useState(null);
  const [renamingType, setRenamingType] = useState(null);
  const [tempRenamingName, setTempRenamingName] = useState("");


  // --- Derived Logic ---

  const displayedSemesters = useMemo(() => {
    return semesters.filter(s => !!s.archived === viewingArchived);
  }, [semesters, viewingArchived]);

  const semesterTotalSeconds = useMemo(() => {
    return sessions.reduce((acc, session) => acc + session.durationSeconds, 0);
  }, [sessions]);

  // --- Modal Helpers ---
  const showAlert = (title, message) => {
      setModalConfig({ isOpen: true, title, message, type: 'alert', onConfirm: null });
  };

  const showConfirm = (title, message, action) => {
      setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm: action });
  };

  const closeModal = () => {
      setModalConfig({ ...modalConfig, isOpen: false });
  };

  const handleModalConfirm = () => {
      if (modalConfig.onConfirm) modalConfig.onConfirm();
      closeModal();
  };

  // --- Calendar Logic ---
  const calendarData = useMemo(() => {
      const data = {};
      if (!sessions || sessions.length === 0) return data;

      sessions.forEach(session => {
          if (!session.startTime) return; 

          try {
            const d = new Date(session.startTime);
            if (isNaN(d.getTime())) return; 

            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            if (!data[dateStr]) data[dateStr] = 0;
            data[dateStr] += session.durationSeconds;
          } catch (e) {
            console.error("Error processing session date:", e);
          }
      });
      return data;
  }, [sessions]);

  const getCalendarCells = () => {
      if (!currentDate || isNaN(currentDate.getTime())) return [];

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const daysInMonth = lastDay.getDate();
      const startDayOfWeek = firstDay.getDay(); 
      
      const cells = [];
      
      for (let i = 0; i < startDayOfWeek; i++) {
          cells.push({ type: 'empty', key: `empty-${i}` });
      }
      
      for (let i = 1; i <= daysInMonth; i++) {
          const m = String(month + 1).padStart(2, '0');
          const d = String(i).padStart(2, '0');
          const dateStr = `${year}-${m}-${d}`;
          
          const seconds = calendarData[dateStr] || 0;
          
          cells.push({ 
              type: 'day', 
              day: i, 
              key: `day-${i}`,
              seconds: seconds,
              hours: (seconds / 3600).toFixed(1)
          });
      }
      return cells;
  };

  const getIntensityColor = (seconds) => {
      if (seconds === 0) return 'rgba(255,255,255,0.05)';
      const hours = seconds / 3600;
      let r = 0, g = 0, b = 0;
      try {
        if (primaryColor && primaryColor.startsWith('#')) {
            if (primaryColor.length === 4) {
                r = parseInt(primaryColor[1] + primaryColor[1], 16);
                g = parseInt(primaryColor[2] + primaryColor[2], 16);
                b = parseInt(primaryColor[3] + primaryColor[3], 16);
            } else if (primaryColor.length === 7) {
                r = parseInt(primaryColor.slice(1, 3), 16);
                g = parseInt(primaryColor.slice(3, 5), 16);
                b = parseInt(primaryColor.slice(5, 7), 16);
            }
        }
      } catch (e) { r = 100; g = 100; b = 100; }

      let opacity = 0.2;
      if (hours >= 6) opacity = 1;
      else if (hours >= 3) opacity = 0.8;
      else if (hours >= 1) opacity = 0.5;
      
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const changeMonth = (offset) => {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + offset);
      setCurrentDate(newDate);
  };

  const subjectSummaries = useMemo(() => {
    const summary = {};
    sessions.forEach(session => {
      if (!summary[session.subject]) summary[session.subject] = 0;
      summary[session.subject] += session.durationSeconds;
    });
    return Object.entries(summary)
      .map(([name, totalSeconds]) => ({ name, totalSeconds }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [sessions]);

  // --- Assessment Stats ---
  const assessmentStats = useMemo(() => {
    if (!assessments.length) return [];
    
    // Filter sessions for the currently selected subject
    const subjectSessions = sessions.filter(s => s.subject === selectedSubject);
    
    const processedAssessments = [];
    
    // Collect all unique types found in assessments + any defined types
    const distinctTypes = new Set(assessments.map(a => a.type));
    assignmentTypes.forEach(t => distinctTypes.add(t));
    const allTypesToProcess = Array.from(distinctTypes);
    
    allTypesToProcess.forEach(type => {
        const typeAssessments = assessments
            .filter(a => a.type === type)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const typeSessions = subjectSessions.filter(s => s.tag === type);

        typeAssessments.forEach((assessment, index) => {
            const prevDate = index === 0 ? 0 : new Date(typeAssessments[index - 1].date).setHours(23, 59, 59, 999);
            const cutoffDate = new Date(assessment.date).setHours(23, 59, 59, 999);

            const timeForAssignment = typeSessions.reduce((total, session) => {
                const sessionTime = new Date(session.startTime).getTime();
                if (sessionTime > prevDate && sessionTime <= cutoffDate) {
                    return total + session.durationSeconds;
                }
                return total;
            }, 0);

            const hrs = parseFloat((timeForAssignment / 3600).toFixed(1));
            const gradeVal = parseFloat(assessment.grade) || 0;

            processedAssessments.push({ 
                ...assessment, 
                calculatedTime: timeForAssignment,
                hours: hrs, 
                numericGrade: gradeVal,
                efficiency: hrs > 0 ? parseFloat((gradeVal / hrs).toFixed(1)) : 0
            });
        });
    });
    
    return processedAssessments.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [assessments, sessions, selectedSubject, assignmentTypes]);

  // --- FILTER Logic ---
  const filteredAssessments = useMemo(() => {
      const hasFilter = Object.keys(visibleTypes).length > 0;
      if (!hasFilter) return assessmentStats;
      return assessmentStats.filter(a => visibleTypes[a.type]);
  }, [assessmentStats, visibleTypes]);

  // Analytics
  const scatterData = useMemo(() => {
    return filteredAssessments.filter(a => a.numericGrade > 0).map(a => ({
      x: a.hours,
      y: a.numericGrade,
      name: `${a.name} (${a.type})`
    }));
  }, [filteredAssessments]);

  const efficiencyData = useMemo(() => {
    return filteredAssessments.filter(a => a.numericGrade > 0).map(a => ({
      name: a.name,
      efficiency: a.efficiency
    }));
  }, [filteredAssessments]);

  const avgEfficiency = useMemo(() => {
    const graded = filteredAssessments.filter(a => a.numericGrade > 0);
    if (graded.length === 0) return 0;
    const totalEff = graded.reduce((sum, item) => sum + item.efficiency, 0);
    return (totalEff / graded.length).toFixed(1);
  }, [filteredAssessments]);

  const prediction = useMemo(() => {
    const points = filteredAssessments.filter(a => a.numericGrade > 0 && a.hours > 0);
    if (points.length < 2) return null;
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    points.forEach(p => {
      sumX += p.hours;
      sumY += p.numericGrade;
      sumXY += (p.hours * p.numericGrade);
      sumXX += (p.hours * p.hours);
    });
    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }, [filteredAssessments]);

  // --- Grade Calculation Logic ---
  const calculationResult = useMemo(() => {
    if (!gradeEntries.length && !assessments.length && assignmentTypes.length === 0) return null;

    const categoryData = {}; 
    assignmentTypes.forEach(t => categoryData[t] = { items: [] });

    gradeEntries.forEach(g => {
        if(categoryData[g.category]) categoryData[g.category].items.push({ score: parseFloat(g.score), total: parseFloat(g.totalPoints) });
    });
    assessments.forEach(a => {
        if(categoryData[a.type]) categoryData[a.type].items.push({ score: parseFloat(a.grade||0), total: 100 });
    });

    let pointsLockedIn = 0;
    let totalWeightUsedInCalc = 0;
    let absoluteScore = 0;

    Object.keys(categoryData).forEach(cat => {
        const data = categoryData[cat];
        const weight = weights[cat] || 0;
        
        if (data.items.length > 0) {
            const sumPercentages = data.items.reduce((acc, i) => acc + (i.score / i.total), 0);
            const average = sumPercentages / data.items.length;
            
            const weightedPoints = average * weight;
            
            pointsLockedIn += weightedPoints;
            absoluteScore += weightedPoints;
            totalWeightUsedInCalc += weight;
        } 
    });

    const currentGrade = totalWeightUsedInCalc > 0 ? (pointsLockedIn / totalWeightUsedInCalc) * 100 : 0;

    const remainingWeight = 100 - totalWeightUsedInCalc;
    let requiredScore = 0;

    if (remainingWeight > 0) {
        requiredScore = (targetGrade - pointsLockedIn) / (remainingWeight / 100);
    }

    let predictedHoursPerItem = 0;
    let totalPredictedHours = 0;
    
    // Count total items left
    const totalItemsLeft = Object.values(remainingItems).reduce((sum, count) => sum + (parseFloat(count) || 0), 0);

    if (prediction && prediction.slope !== 0) {
      predictedHoursPerItem = (requiredScore - prediction.intercept) / prediction.slope;
      
      if (predictedHoursPerItem < 0) predictedHoursPerItem = 0;

      totalPredictedHours = predictedHoursPerItem * totalItemsLeft;
    }

    return {
      currentGrade: currentGrade.toFixed(2),
      absoluteAverage: absoluteScore.toFixed(2),
      requiredScore: requiredScore.toFixed(2),
      remainingWeight: remainingWeight.toFixed(0),
      predictedHoursPerItem: predictedHoursPerItem > 0 ? predictedHoursPerItem.toFixed(1) : 0,
      totalPredictedHours: totalPredictedHours > 0 ? totalPredictedHours.toFixed(1) : 0,
      totalItemsLeft: totalItemsLeft,
      hasRegression: !!prediction
    };
  }, [gradeEntries, assessments, weights, targetGrade, prediction, assignmentTypes, remainingItems]);

  // --- Effects ---
  useEffect(() => { fetchSemesters(); }, []);
  
  useEffect(() => {
      localStorage.setItem('studyTrackerColor', primaryColor);
      localStorage.setItem('studyTrackerAccent', accentColor);
      localStorage.setItem('studyTrackerBg', backgroundColor);
      localStorage.setItem('studyTrackerText', textColor);
      if(leftGif) localStorage.setItem('studyTrackerLeftGif', leftGif);
      else localStorage.removeItem('studyTrackerLeftGif');
      if(rightGif) localStorage.setItem('studyTrackerRightGif', rightGif);
      else localStorage.removeItem('studyTrackerRightGif');
      localStorage.setItem('studyTrackerGifSize', gifSize);
      localStorage.setItem('studyTrackerGifSpacing', gifSpacing);
  }, [primaryColor, accentColor, backgroundColor, textColor, leftGif, rightGif, gifSize, gifSpacing]);

  useEffect(() => {
    if (activeSemesterId) {
      fetchSubjects(activeSemesterId);
      fetchSessions(activeSemesterId);
      if (activeSemesterId !== prevSemesterId) {
          setSessionTag(""); 
          setAssessments([]);
          setPrevSemesterId(activeSemesterId);
      }
    }
  }, [activeSemesterId, prevSemesterId]);

  useEffect(() => {
    if (selectedSubjectId) {
      const sub = subjects.find(s => s.id === selectedSubjectId);
      let loadedTypes = [];
      if (sub && sub.assignmentTypes && sub.assignmentTypes.length > 0) {
          loadedTypes = sub.assignmentTypes;
      } else {
          loadedTypes = [];
      }
      setAssignmentTypes(loadedTypes);
      setVisibleTypes(prev => {
          const next = { ...prev };
          loadedTypes.forEach(t => { if (next[t] === undefined) next[t] = true; });
          return next;
      });
      if (loadedTypes.length > 0) {
          setNewAssessment(prev => ({ ...prev, type: loadedTypes[0] }));
          setNewGradeEntry(prev => ({ ...prev, category: loadedTypes[0] }));
      } else {
          setNewAssessment(prev => ({ ...prev, type: "" }));
          setNewGradeEntry(prev => ({ ...prev, category: "" }));
      }
      if (sub && sub.gradeWeights) setWeights(sub.gradeWeights);
      else setWeights({});
      setRemainingItems({});
      fetchAssessments(selectedSubjectId);
      fetchGrades(selectedSubjectId);
    } else {
      setAssessments([]);
      setGradeEntries([]);
      setAssignmentTypes([]);
      setRemainingItems({});
    }
  }, [selectedSubjectId, subjects]);

  useEffect(() => {
    let interval = null;
    if (isStudying) {
      interval = setInterval(() => setElapsed((Date.now() - startTime) / 1000), 1000);
    } else clearInterval(interval);
    return () => clearInterval(interval);
  }, [isStudying, startTime]);

  useEffect(() => {
    const closeMenu = () => { 
        setOpenTabMenu(null); 
        setOpenAssessmentMenu(null); 
        setOpenTypeMenu(null);
        setShowSettings(false);
    };
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);
  
  // --- API Calls ---
  const fetchSemesters = async () => { 
      const data = await db.semesters.toArray();
      setSemesters(data);
      const actives = data.filter(s => !s.archived);
      if (actives.length > 0 && !activeSemesterId) {
          setActiveSemesterId(actives[0].id);
          setPrevSemesterId(actives[0].id); 
      }
  };

  const fetchSubjects = async (semId) => { 
      const data = await db.subjects.where('semesterId').equals(semId).toArray();
      setSubjects(data); 
      const savedId = selectionsRef.current[semId];
      if (savedId && data.find(s => s.id === savedId)) {
          const sub = data.find(s => s.id === savedId);
          setSelectedSubject(sub.name);
          setSelectedSubjectId(sub.id);
      } else {
          setSelectedSubject("");
          setSelectedSubjectId("");
      }
  };

  const fetchSessions = async (semId) => { 
      const data = await db.sessions.where('semesterId').equals(semId).toArray();
      data.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      setSessions(data);
  };

  const fetchAssessments = async (subId) => { 
      const data = await db.assessments.where('subjectId').equals(subId).toArray();
      setAssessments(data);
  };

  const fetchGrades = async (subId) => { 
      const data = await db.gradeEntries.where('subjectId').equals(subId).toArray();
      setGradeEntries(data);
  };

  const saveTypes = async (id, types) => { 
      await db.subjects.update(id, { assignmentTypes: types });
  };
  
  const handleAddType = async () => {
      if (!newTypeName.trim()) return;
      if (assignmentTypes.includes(newTypeName)) return showAlert("Error", "Type already exists");
      const updatedTypes = [...assignmentTypes, newTypeName];
      setAssignmentTypes(updatedTypes);
      setVisibleTypes(prev => ({...prev, [newTypeName]: true}));
      if (updatedTypes.length === 1) {
          setNewAssessment(prev => ({...prev, type: newTypeName}));
          setNewGradeEntry(prev => ({...prev, category: newTypeName}));
      }
      setNewTypeName("");
      setWeights(prev => ({...prev, [newTypeName]: 0}));
      await saveTypes(selectedSubjectId, updatedTypes);
  };

  const toggleTypeVisibility = (type) => {
      setVisibleTypes(prev => ({...prev, [type]: !prev[type]}));
  };

  const startRenamingType = (type) => {
      setRenamingType(type);
      setTempRenamingName(type);
      setOpenTypeMenu(null);
  };

  const cancelRenameType = () => {
      setRenamingType(null);
      setTempRenamingName("");
  };

  const submitRenameType = async (oldName) => {
      if (!tempRenamingName.trim()) return;
      if (assignmentTypes.includes(tempRenamingName) && tempRenamingName !== oldName) return showAlert("Error", "Type already exists");
      const newName = tempRenamingName.trim();
      const updatedTypes = assignmentTypes.map(t => t === oldName ? newName : t);
      setAssignmentTypes(updatedTypes);
      const newWeights = { ...weights };
      if (newWeights[oldName] !== undefined) {
          newWeights[newName] = newWeights[oldName];
          delete newWeights[oldName];
      }
      setWeights(newWeights);
      await db.transaction('rw', db.gradeEntries, db.assessments, db.subjects, async () => {
          await db.gradeEntries.where({ subjectId: selectedSubjectId, category: oldName }).modify({ category: newName });
          await db.assessments.where({ subjectId: selectedSubjectId, type: oldName }).modify({ type: newName });
          await db.subjects.update(selectedSubjectId, { assignmentTypes: updatedTypes, gradeWeights: newWeights });
      });
      fetchGrades(selectedSubjectId);
      fetchAssessments(selectedSubjectId);
      setRenamingType(null);
  };

  const handleDeleteType = async (typeToDelete) => {
      showConfirm("Delete Category?", `Are you sure you want to delete "${typeToDelete}"?`, async () => {
        const updatedTypes = assignmentTypes.filter(t => t !== typeToDelete);
        setAssignmentTypes(updatedTypes);
        const newWeights = { ...weights };
        delete newWeights[typeToDelete];
        setWeights(newWeights);
        await saveTypes(selectedSubjectId, updatedTypes);
        await saveConfig(selectedSubjectId, newWeights);
      });
  };

  const handleAddGrade = async () => {
    if (!newGradeEntry.name || !newGradeEntry.score || !newGradeEntry.category) return showAlert("Missing Info", "Please fill all fields.");
    const scoreVal = parseFloat(newGradeEntry.score);
    const totalVal = parseFloat(newGradeEntry.totalPoints);
    const percentage = totalVal > 0 ? ((scoreVal / totalVal) * 100).toFixed(1) : 0;
    await db.assessments.add({
        name: newGradeEntry.name,
        type: newGradeEntry.category,
        date: new Date().toISOString().split('T')[0], 
        grade: percentage,
        subjectId: selectedSubjectId
    });
    fetchAssessments(selectedSubjectId);
    setNewGradeEntry({ ...newGradeEntry, name: "", score: "" });
  };
  
  const handleDeleteGrade = async (id) => { 
      await db.gradeEntries.delete(id); 
      fetchGrades(selectedSubjectId); 
  };
  
  const saveConfig = async (id, w) => {
      await db.subjects.update(id, { gradeWeights: w });
  };

  const handleSaveConfig = async (weightsToSave = weights) => { 
      if(!selectedSubjectId) return; 
      await saveConfig(selectedSubjectId, weightsToSave);
      showAlert("Success", "Configuration Saved!");
  };

  const startEditingGradeList = (item, type) => {
      setEditingGradeId(item.id);
      setEditingGradeType(type);
      if (type === 'manual') {
          setEditGradeData({ name: item.name, score: item.score, totalPoints: item.totalPoints, category: item.category });
      } else {
          setEditGradeData({ name: item.name, score: item.grade, totalPoints: "100", category: item.type });
      }
  };

  const saveEditedGradeList = async () => {
      if (editingGradeType === 'manual') {
          await db.gradeEntries.update(editingGradeId, editGradeData);
          fetchGrades(selectedSubjectId);
      } else {
          const score = parseFloat(editGradeData.score);
          const total = parseFloat(editGradeData.totalPoints);
          const percentage = total > 0 ? ((score / total) * 100).toFixed(1) : 0;
          await db.assessments.update(editingGradeId, {
              name: editGradeData.name,
              type: editGradeData.category,
              grade: percentage
          });
          fetchAssessments(selectedSubjectId);
      }
      setEditingGradeId(null);
      setEditingGradeType(null);
  };

  const cancelEditGradeList = () => {
      setEditingGradeId(null);
      setEditingGradeType(null);
  };

  const handleDeleteFromEdit = async () => {
      showConfirm("Delete Assignment?", "Are you sure you want to delete this assignment?", async () => {
        if (editingGradeType === 'manual') {
            await handleDeleteGrade(editingGradeId);
        } else {
            await handleDeleteAssessment(editingGradeId);
        }
        setEditingGradeId(null);
        setEditingGradeType(null);
      });
  };

  const handleAddAssessment = async () => { 
      if (!newAssessment.name || !newAssessment.date || !selectedSubjectId || !newAssessment.type) return showAlert("Missing Info", "Please select a Type."); 
      const gradeVal = parseFloat(newAssessment.grade);
      const formattedGrade = !isNaN(gradeVal) ? gradeVal.toFixed(1) : "0.0";
      await db.assessments.add({ 
          ...newAssessment, 
          grade: formattedGrade, 
          subjectId: selectedSubjectId 
      });
      setNewAssessment({ name: "", type: assignmentTypes[0] || "", date: "", grade: "" }); 
      fetchAssessments(selectedSubjectId); 
      setShowAddAssessment(false); 
  };
  
  const startEditingAssessment = (assess) => { setEditingAssessmentId(assess.id); setEditAssessmentData({ name: assess.name, type: assess.type, date: assess.date, grade: assess.grade }); setOpenAssessmentMenu(null); };
  
  const saveAssessment = async () => { 
      if (!editingAssessmentId) return; 
      await db.assessments.update(editingAssessmentId, editAssessmentData);
      setEditingAssessmentId(null); 
      fetchAssessments(selectedSubjectId); 
  };
  
  const handleDeleteAssessment = async (id) => { 
      await db.assessments.delete(id); 
      fetchAssessments(selectedSubjectId); 
  };

  const handleSubjectChange = (e) => { 
      const subName = e.target.value; 
      setSelectedSubject(subName); 
      const subObj = subjects.find(s => s.name === subName); 
      const newId = subObj ? subObj.id : "";
      setSelectedSubjectId(newId); 
      setSessionTag(""); 
      if (activeSemesterId) selectionsRef.current[activeSemesterId] = newId;
  };

  const handleStart = () => { if (!selectedSubject) return showAlert("No Class", "Select a class first!"); setStartTime(Date.now()); setIsStudying(true); setElapsed(0); };
  
  const handleStop = async () => { 
      setIsStudying(false); 
      const endTime = Date.now(); 
      await db.sessions.add({
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          durationSeconds: Math.floor((endTime - startTime) / 1000),
          subject: selectedSubject,
          tag: sessionTag,
          semesterId: activeSemesterId
      });
      fetchSessions(activeSemesterId); 
      setSessionTag(""); 
  };
  
  const formatTime = (seconds) => { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = Math.floor(seconds % 60); return `${h}h ${m}m ${s}s`; };
  
  const handleAddSemester = async () => { 
      if (!newSemesterName.trim()) return; 
      const id = await db.semesters.add({ name: newSemesterName, archived: false });
      setNewSemesterName(""); 
      const allSemesters = await db.semesters.toArray();
      setSemesters(allSemesters);
      if (!viewingArchived) {
          setActiveSemesterId(id);
          setPrevSemesterId(id);
      }
  };
  
  const saveSemesterName = async (id, currentArchivedStatus) => { 
      if (!tempSemesterName.trim()) return; 
      await db.semesters.update(id, { name: tempSemesterName });
      const updated = semesters.map(s => s.id === id ? { ...s, name: tempSemesterName } : s); 
      setSemesters(updated); 
      setEditingSemesterId(null); 
  };
  
  const startEditingSemester = (sem) => { setEditingSemesterId(sem.id); setTempSemesterName(sem.name); setOpenTabMenu(null); };
  
  const handleArchiveSemester = async (id, currentStatus) => { 
      await db.semesters.update(id, { archived: !currentStatus });
      fetchSemesters();
      if (activeSemesterId === id) setActiveSemesterId(null); 
  };
  
  const handleDeleteSemester = async (id) => { 
      showConfirm("Delete Semester?", "Are you sure you want to delete this semester permanently?", async () => {
        await db.semesters.delete(id); 
        fetchSemesters();
        if (activeSemesterId === id) setActiveSemesterId(null); 
      });
  };
  
  const handleAddSubject = async () => { 
      if (!newSubjectName.trim() || !activeSemesterId) return; 
      await db.subjects.add({ name: newSubjectName, semesterId: activeSemesterId });
      setNewSubjectName(""); 
      fetchSubjects(activeSemesterId); 
  };
  
  const handleDeleteSubject = async (id) => { 
      await db.subjects.delete(id); 
      fetchSubjects(activeSemesterId); 
  };

  const openAddLogForm = () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const toLocalISO = (d) => {
          const offset = d.getTimezoneOffset() * 60000;
          return new Date(d.getTime() - offset).toISOString().slice(0, 16);
      };
      setLogFormData({
          id: null,
          subject: selectedSubject || (subjects.length > 0 ? subjects[0].name : ""),
          tag: "",
          startTime: toLocalISO(oneHourAgo),
          endTime: toLocalISO(now)
      });
      setShowLogForm(true);
  };

  const handleEditLog = (session) => {
      const toLocalInput = (iso) => {
          const d = new Date(iso);
          const offset = d.getTimezoneOffset() * 60000;
          return new Date(d.getTime() - offset).toISOString().slice(0, 16);
      };
      setLogFormData({
          id: session.id,
          subject: session.subject,
          tag: session.tag || "",
          startTime: toLocalInput(session.startTime),
          endTime: toLocalInput(session.endTime)
      });
      setShowLogForm(true);
  };

  const handleDeleteLog = async (id) => {
      showConfirm("Delete Log?", "Are you sure you want to delete this session log?", async () => {
        await db.sessions.delete(id);
        fetchSessions(activeSemesterId);
      });
  };

  const handleSaveLog = async () => {
      if(!logFormData.subject || !logFormData.startTime || !logFormData.endTime) return showAlert("Error", "Please fill all fields");
      const start = new Date(logFormData.startTime);
      const end = new Date(logFormData.endTime);
      if(end <= start) return showAlert("Error", "End time must be after start time");
      const duration = Math.floor((end - start) / 1000);
      const payload = {
          subject: logFormData.subject,
          tag: logFormData.tag, 
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          durationSeconds: duration,
          semesterId: activeSemesterId
      };
      if(logFormData.id) {
          await db.sessions.update(logFormData.id, payload);
      } else {
          await db.sessions.add(payload);
      }
      setShowLogForm(false);
      fetchSessions(activeSemesterId);
  };

  const handleGifUpload = (e, side) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
          return showAlert("File Too Large", "Please upload an image smaller than 2MB.");
      }
      const reader = new FileReader();
      reader.onloadend = () => {
          if (side === 'left') setLeftGif(reader.result);
          else setRightGif(reader.result);
      };
      reader.readAsDataURL(file);
  };

  const handleThemeReset = () => {
      showConfirm("Reset Theme?", "Are you sure you want to reset all theme settings to default?", () => {
          setPrimaryColor('#61dafb');
          setAccentColor('#61dafb');
          setBackgroundColor('#282c34');
          setTextColor('#ffffff');
          setGifSize(100);
          setGifSpacing(20);
          setLeftGif(null);
          setRightGif(null);
      });
  };

  return (
    <div className="App">
      <style>{`
        * { box-sizing: border-box; }
        body { overflow-x: hidden; width: 100vw; }
        :root { 
            --primary-color: ${primaryColor};
            --accent-color: ${accentColor};
            --bg-color: ${backgroundColor};
            --text-color: ${textColor};
        }
        body, .App, .App-header { background-color: var(--bg-color) !important; color: var(--text-color) !important; }
        
        /* Primary (Buttons) */
        .toggle-btn.active, .btn-full, .btn-small, .btn-full-width { 
            background-color: var(--primary-color) !important; 
            color: #000; 
        }
        
        /* Accent (Tabs, Text) */
        .active-tab { 
            background-color: transparent !important; 
            border-bottom: 2px solid var(--accent-color) !important; 
            color: var(--accent-color) !important; 
        }
        .highlight, .summary-time, .giant-text { color: var(--accent-color) !important; }
        .highlight-card { border-left-color: var(--accent-color) !important; }
        .active-filter { background-color: var(--accent-color) !important; color: #000 !important; }
        
        .sub-nav-item.active {
            color: var(--accent-color) !important;
            border-bottom-color: var(--accent-color) !important;
        }
        .sidebar-header-row h4, .management-header h3 {
            color: var(--accent-color) !important;
        }
        .toggle-add-btn, .toggle-icon {
            color: var(--accent-color) !important;
            border-color: var(--accent-color) !important;
        }
        .summary-list .summary-name {
            color: var(--text-color) !important;
        }
        .type-manager-header h4 {
            color: var(--text-color) !important;
        }

        /* Inputs */
        input[type="file"] { display: none; }
        .custom-file-upload {
            border: 1px solid var(--text-color);
            display: inline-block;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 0.8rem;
            text-align: center;
            width: 100%;
            background: rgba(255,255,255,0.05);
            margin-bottom: 5px;
        }
        .custom-file-upload:hover { background: rgba(255,255,255,0.1); }

        input:not([type="file"]), select, .tab-edit-input { 
            background-color: rgba(255,255,255,0.1); 
            color: var(--text-color); 
            border: 1px solid var(--text-color);
        }
        .calc-card, .sidebar-form, .assessment-card, .grade-item, .summary-card {
            background-color: rgba(255,255,255,0.05);
            color: var(--text-color);
        }
        .tab { color: var(--text-color); }
        
        /* Sliders */
        input[type="range"] {
            -webkit-appearance: none;
            width: 100%;
            height: 5px;
            border-radius: 5px;
            background: #d3d3d3;
            outline: none;
            border: none;
        }
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 15px;
            height: 15px;
            border-radius: 50%;
            background: var(--primary-color);
            cursor: pointer;
        }

        /* Dropdown options */
        option {
            background-color: #ffffff !important;
            color: #000000 !important;
        }
        
        /* Calendar Styles */
        .calendar-container {
            width: 100%;
            padding: 20px;
            background: rgba(255,255,255,0.02);
            border-radius: 10px;
        }
        .calendar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .calendar-header h3 { margin: 0; color: var(--accent-color); }
        .calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 5px;
        }
        .cal-day-header {
            text-align: center;
            font-weight: bold;
            padding: 10px;
            color: var(--text-color);
            opacity: 0.7;
        }
        .cal-day {
            aspect-ratio: 1;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            cursor: default;
            font-size: 0.9rem;
            color: #fff;
            transition: transform 0.1s ease;
        }
        .cal-day:hover {
            transform: scale(1.1);
            z-index: 10;
        }
        .cal-tooltip {
            position: absolute;
            bottom: 100%;
            background: #000;
            color: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 20;
            margin-bottom: 5px;
        }
        .cal-day:hover .cal-tooltip {
            opacity: 1;
        }

        /* --- New Vertical List Styles for Weights --- */
        .weights-grid {
            display: flex !important;
            flex-direction: column !important;
            gap: 8px;
            width: 100%;
        }
        .weight-row {
            display: grid !important;
            grid-template-columns: minmax(120px, 2fr) 80px 80px; 
            gap: 10px;
            align-items: center;
        }
        .weight-input-group {
            /* Inherits styles from .weight-row if applied correctly, but we set manually */
            display: grid !important;
            grid-template-columns: minmax(120px, 2fr) 80px 80px;
            gap: 10px;
            align-items: center;
        }

        /* --- Custom Modal Styles --- */
        .modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }
        .modal-content {
            background-color: var(--bg-color);
            border: 1px solid var(--primary-color);
            border-radius: 10px;
            padding: 25px;
            min-width: 300px;
            max-width: 90%;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
            color: var(--text-color);
        }
        .modal-title {
            margin-top: 0;
            margin-bottom: 10px;
            color: var(--accent-color);
            font-size: 1.2rem;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding-bottom: 10px;
        }
        .modal-body {
            margin-bottom: 20px;
            line-height: 1.5;
        }
        .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
      `}</style>
      <header className="App-header">
        {/* --- Custom Modal --- */}
        {modalConfig.isOpen && (
            <div className="modal-overlay" onClick={closeModal}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <h3 className="modal-title">{modalConfig.title}</h3>
                    <div className="modal-body">{modalConfig.message}</div>
                    <div className="modal-actions">
                        {modalConfig.type === 'confirm' && (
                            <button className="btn-small" style={{background:'#555'}} onClick={closeModal}>Cancel</button>
                        )}
                        <button className="btn-small" onClick={handleModalConfirm}>OK</button>
                    </div>
                </div>
            </div>
        )}

        <div style={{display: 'flex', justifyContent:'space-between', alignItems:'center', width: '100%', padding: '0 20px', height: '60px'}}>
            <h1></h1>
            <div style={{position: 'relative'}}>
                <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} style={{background: 'none', border:'none', fontSize:'1.5rem', cursor:'pointer'}}>⚙️</button>
                {showSettings && (
                    <div onClick={(e) => e.stopPropagation()} style={{position:'absolute', right:0, top:'40px', background: backgroundColor, border:`1px solid ${textColor}`, borderRadius:'8px', padding:'15px', zIndex:1000, width:'250px', boxShadow:'0 4px 10px rgba(0,0,0,0.3)', maxHeight:'80vh', overflowY:'auto'}}>
                        <h4 style={{margin:'0 0 10px 0', borderBottom:`1px solid ${textColor}`, paddingBottom:'5px'}}>Theme Settings</h4>
                        
                        <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                            {/* Theme Settings Content */}
                            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <label style={{fontSize:'0.9rem'}}>Button Color</label>
                                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{width:'40px', height:'30px', padding:0, border:'none', background:'none'}} />
                                </div>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <label style={{fontSize:'0.9rem'}}>Accent (Tabs/Text)</label>
                                    <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{width:'40px', height:'30px', padding:0, border:'none', background:'none'}} />
                                </div>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <label style={{fontSize:'0.9rem'}}>Background</label>
                                    <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} style={{width:'40px', height:'30px', padding:0, border:'none', background:'none'}} />
                                </div>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <label style={{fontSize:'0.9rem'}}>Text Color</label>
                                    <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{width:'40px', height:'30px', padding:0, border:'none', background:'none'}} />
                                </div>
                            </div>

                            <hr style={{width:'100%', borderColor: textColor, opacity:0.3}} />

                            <div style={{fontSize:'0.9rem', fontWeight:'bold', marginBottom:'5px'}}>GIF Controls</div>
                            
                            <div>
                                <label style={{fontSize:'0.8rem'}}>Size: {gifSize}px</label>
                                <input type="range" min="20" max="300" value={gifSize} onChange={(e) => setGifSize(e.target.value)} />
                            </div>
                            
                            <div>
                                <label style={{fontSize:'0.8rem'}}>Distance: {gifSpacing}px</label>
                                <input type="range" min="0" max="200" value={gifSpacing} onChange={(e) => setGifSpacing(e.target.value)} />
                            </div>

                            <div style={{marginTop:'5px'}}>
                                <label className="custom-file-upload">
                                    <input type="file" accept="image/*" onChange={(e) => handleGifUpload(e, 'left')} />
                                    Upload Left GIF
                                </label>
                                {leftGif && <button onClick={() => setLeftGif(null)} style={{marginTop:'2px', fontSize:'0.7rem', padding:'2px 5px', cursor:'pointer', width:'100%', border:`1px solid ${textColor}`, background:'transparent', color:textColor}}>Clear Left GIF</button>}
                            </div>

                            <div style={{marginTop:'5px'}}>
                                <label className="custom-file-upload">
                                    <input type="file" accept="image/*" onChange={(e) => handleGifUpload(e, 'right')} />
                                    Upload Right GIF
                                </label>
                                {rightGif && <button onClick={() => setRightGif(null)} style={{marginTop:'2px', fontSize:'0.7rem', padding:'2px 5px', cursor:'pointer', width:'100%', border:`1px solid ${textColor}`, background:'transparent', color:textColor}}>Clear Right GIF</button>}
                            </div>

                            <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                                <button onClick={() => setShowSettings(false)} style={{flex:1, padding:'5px', background: primaryColor, border:'none', borderRadius:'4px', color:'#000', fontWeight:'bold', cursor:'pointer'}}>Save</button>
                                <button onClick={handleThemeReset} style={{flex:1, padding:'5px', background:'transparent', border:`1px solid ${textColor}`, borderRadius:'4px', color: textColor, cursor:'pointer'}}>Reset</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
        
        {/* --- View Toggles --- */}
        <div className="view-toggle">
           <button className={`toggle-btn ${!viewingArchived ? 'active' : ''}`} onClick={() => { setViewingArchived(false); setActiveSemesterId(null); }}>Current</button>
           <button className={`toggle-btn ${viewingArchived ? 'active' : ''}`} onClick={() => { setViewingArchived(true); setActiveSemesterId(null); }}>Archived</button>
        </div>

        <div className="tabs-container">
          {displayedSemesters.map(sem => (
            <div key={sem.id} className={`tab ${activeSemesterId === sem.id ? 'active-tab' : ''}`} onClick={() => setActiveSemesterId(sem.id)}>
              {editingSemesterId === sem.id ? (
                <input type="text" value={tempSemesterName} onChange={(e) => setTempSemesterName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveSemesterName(sem.id, sem.archived); e.stopPropagation(); }} onClick={(e) => e.stopPropagation()} onBlur={() => saveSemesterName(sem.id, sem.archived)} autoFocus className="tab-edit-input" />
              ) : <span>{sem.name}</span>}
              <div className="tab-menu-trigger" onClick={(e) => { e.stopPropagation(); setOpenTabMenu(openTabMenu === sem.id ? null : sem.id); }}>⋮</div>
              {openTabMenu === sem.id && (<div className="tab-dropdown"><div onClick={() => startEditingSemester(sem)}>Rename</div><div onClick={() => handleArchiveSemester(sem.id, sem.archived)}>{sem.archived ? "Unarchive" : "Archive"}</div><div onClick={() => handleDeleteSemester(sem.id)} className="delete-option">Delete</div></div>)}
            </div>
          ))}
          {!viewingArchived && (<div className="add-tab-container"><input value={newSemesterName} onChange={(e) => setNewSemesterName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSemester()} placeholder="New..." /><button onClick={handleAddSemester}>+</button></div>)}
        </div>

        {activeSemesterId && (
          <>
            <div className="sub-nav">
              <span className={`sub-nav-item ${activeView === 'tracker' ? 'active' : ''}`} onClick={() => setActiveView('tracker')}>Tracker</span>
              <span className={`sub-nav-item ${activeView === 'analytics' ? 'active' : ''}`} onClick={() => setActiveView('analytics')}>Analytics</span>
              <span className={`sub-nav-item ${activeView === 'calculator' ? 'active' : ''}`} onClick={() => setActiveView('calculator')}>Calculator</span>
              <span className={`sub-nav-item ${activeView === 'calendar' ? 'active' : ''}`} onClick={() => setActiveView('calendar')}>Calendar</span>
            </div>

            <div className="main-layout">
              {/* --- TRACKER --- */}
              {activeView === 'tracker' && (
                  <>
                    <div className="content-area">
                        {/* GIFs flanking the timer */}
                        <div style={{display:'grid', gridTemplateColumns: `1fr auto 1fr`, gap:`${gifSpacing}px`, alignItems:'center'}}>
                            
                            <div style={{justifySelf:'end'}}>
                                <OptimizedImage src={leftGif} size={gifSize} side="left" spacing={gifSpacing} />
                            </div>

                            <div className="timer-container" style={{margin:0}}>
                                <select value={selectedSubject} onChange={handleSubjectChange} className="subject-select"><option value="" disabled>Select a Class</option>{subjects.map(sub => <option key={sub.id} value={sub.name}>{sub.name}</option>)}</select>
                                
                                <select 
                                    value={sessionTag} 
                                    onChange={(e) => setSessionTag(e.target.value)} 
                                    className="subject-select" 
                                    style={{marginTop:'10px', fontSize:'0.9rem', width:'80%', opacity: selectedSubject ? 1 : 0.5}}
                                    disabled={!selectedSubject || isStudying}
                                >
                                    <option value="">General Study (No Tag)</option>
                                    {assignmentTypes.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>

                                <h2>{formatTime(elapsed)}</h2>
                                {!isStudying ? <button className="btn start" onClick={handleStart} style={{backgroundColor: primaryColor, color: '#000'}}>Start Studying</button> : <button className="btn stop" onClick={handleStop}>Stop</button>}
                            </div>

                            <div style={{justifySelf:'start'}}>
                                <OptimizedImage src={rightGif} size={gifSize} side="right" spacing={gifSpacing} />
                            </div>

                        </div>
                        
                        {/* --- Session History --- */}
                        <div className="history-container">
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                              <h3 style={{margin:0}}>Session History</h3>
                              <button className="btn-small" onClick={openAddLogForm}>+ Add Log</button>
                          </div>

                          {showLogForm && (
                              <div className="sidebar-form" style={{marginBottom:'15px', background:'rgba(255,255,255,0.05)', padding:'15px'}}>
                                  <h4 style={{marginTop:0}}>{logFormData.id ? "Edit Log" : "New Log"}</h4>
                                  <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                                      <select value={logFormData.subject} onChange={e => setLogFormData({...logFormData, subject: e.target.value})} style={{flex:1}}>
                                          {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                      </select>
                                  </div>
                                  
                                  <div style={{marginBottom:'10px'}}>
                                      <label style={{fontSize:'0.8rem', display:'block', marginBottom:'4px'}}>Tag (Category):</label>
                                      <select value={logFormData.tag} onChange={e => setLogFormData({...logFormData, tag: e.target.value})} style={{width:'100%'}}>
                                          <option value="">None</option>
                                          {assignmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                      </select>
                                  </div>

                                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px'}}>
                                      <input type="datetime-local" value={logFormData.startTime} onChange={e => setLogFormData({...logFormData, startTime: e.target.value})} />
                                      <input type="datetime-local" value={logFormData.endTime} onChange={e => setLogFormData({...logFormData, endTime: e.target.value})} />
                                  </div>
                                  <div style={{display:'flex', gap:'10px'}}>
                                      <button className="btn-full" onClick={handleSaveLog}>Save</button>
                                      <button className="btn-full" style={{background:'#555'}} onClick={() => setShowLogForm(false)}>Cancel</button>
                                  </div>
                              </div>
                          )}

                          <table>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Class</th>
                                <th>Tag</th>
                                <th>Start</th>
                                <th>End</th>
                                <th>Duration</th>
                                <th style={{textAlign:'center'}}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessions.map(s => (
                                <tr key={s.id}>
                                  <td>{new Date(s.startTime).toLocaleDateString()}</td>
                                  <td>{s.subject}</td>
                                  <td style={{fontSize:'0.85rem', opacity:0.8}}>{s.tag || '-'}</td>
                                  <td>{new Date(s.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                  <td>{new Date(s.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                  <td>{formatTime(s.durationSeconds)}</td>
                                  <td>
                                      <div style={{display:'flex', gap:'5px', justifyContent:'center'}}>
                                          <button onClick={() => handleEditLog(s)} className="btn-small" style={{fontSize:'0.8rem', padding:'2px 5px', background:'#ffffffff', minWidth:'30px'}}>✏️</button>
                                          <button onClick={() => handleDeleteLog(s.id)} className="btn-small" style={{fontSize:'0.8rem', padding:'2px 5px', background:'#e28b8bff', minWidth:'30px'}}>🗑</button>
                                      </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                    </div>
                    <div className="right-column">
                      <div className="summary-sidebar">
                        <h3>Subject Totals</h3>
                        <div className="summary-card" style={{borderLeft:`4px solid ${accentColor}`, marginBottom:'10px', background:'rgba(255,255,255,0.08)'}}>
                            <span className="summary-name" style={{fontWeight:'bold', color: textColor}}>Semester Total</span>
                            <span className="summary-time" style={{fontWeight:'bold', color: accentColor}}>{formatTime(semesterTotalSeconds)}</span>
                        </div>
                        <div className="summary-list">{subjectSummaries.map((item, i) => (<div key={i} className={`summary-card ${selectedSubject === item.name ? 'highlight-card' : ''}`}><span className="summary-name">{item.name}</span><span className="summary-time">{formatTime(item.totalSeconds)}</span></div>))}</div>
                        {selectedSubjectId && !viewingArchived && (
                          <div className="sidebar-assessments">
                            
                            <div className="type-manager-header" onClick={() => setShowTypeManager(!showTypeManager)}>
                                <h4>Categories & Filters</h4>
                                <span className="toggle-icon">{showTypeManager ? "▲" : "▼"}</span>
                            </div>
                            
                            {showTypeManager && (
                                <div className="type-manager">
                                    <div className="add-type-row-small">
                                        <input placeholder="New Category (e.g. Quiz)" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} />
                                        <button onClick={handleAddType} className="btn-small">+</button>
                                    </div>
                                    <div className="filter-row">
                                        <small>Show:</small>
                                        {assignmentTypes.map(t => (
                                            <span key={t} className={`filter-badge ${visibleTypes[t] ? 'active-filter' : ''}`} onClick={() => toggleTypeVisibility(t)}>
                                                {t}
                                            </span>
                                        ))}
                                        {assignmentTypes.length === 0 && <small style={{fontStyle:'italic', opacity:0.6}}>None</small>}
                                    </div>
                                </div>
                            )}

                            <div className="sidebar-header-row"><h4>Assessments</h4><button className="toggle-add-btn" onClick={() => setShowAddAssessment(!showAddAssessment)}>{showAddAssessment ? "Cancel" : "+ Add"}</button></div>
                            {showAddAssessment && (
                              <div className="sidebar-form">
                                {assignmentTypes.length === 0 ? (
                                    <p style={{color:'#aaa', fontSize:'0.9rem', fontStyle:'italic', textAlign:'center'}}>Add a Category above to start!</p>
                                ) : (
                                    <>
                                        <input type="text" placeholder="Name" value={newAssessment.name} onChange={e => setNewAssessment({...newAssessment, name: e.target.value})} />
                                        <select value={newAssessment.type} onChange={e => setNewAssessment({...newAssessment, type: e.target.value})}>
                                            <option value="" disabled>Select Type...</option>
                                            {assignmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <input type="date" value={newAssessment.date} onChange={e => setNewAssessment({...newAssessment, date: e.target.value})} />
                                        <input type="text" placeholder="Grade" value={newAssessment.grade} onChange={e => setNewAssessment({...newAssessment, grade: e.target.value})} />
                                        <button onClick={handleAddAssessment} className="btn-full">Save</button>
                                    </>
                                )}
                              </div>
                            )}
                            <div className="assessment-list">
                              {filteredAssessments.length === 0 && assessmentStats.length > 0 && <p style={{fontSize:'0.8rem', color:'#777', textAlign:'center'}}>Items hidden by filter.</p>}
                              {filteredAssessments.map(assess => (
                                <div key={assess.id} className="assessment-card-wrapper">
                                  {editingAssessmentId === assess.id ? (
                                    <div className="sidebar-form edit-mode"><input type="text" value={editAssessmentData.name} onChange={e => setEditAssessmentData({...editAssessmentData, name: e.target.value})} /><input type="date" value={editAssessmentData.date} onChange={e => setEditAssessmentData({...editAssessmentData, date: e.target.value})} /><div style={{display:'flex', gap:'5px', marginTop:'5px'}}><button onClick={saveAssessment} className="btn-full" style={{background:'#4CAF50'}}>Save</button></div></div>
                                  ) : (
                                    <div className="assessment-card">
                                      <div className="assess-top"><span className="assess-name">{assess.name} <small style={{fontWeight:'normal', opacity:0.7, fontSize:'0.7rem'}}>({assess.type})</small></span><div style={{display:'flex', alignItems:'center', gap:'8px'}}><span className="assess-grade">{assess.grade}</span><div className="assess-menu-trigger" onClick={(e) => { e.stopPropagation(); setOpenAssessmentMenu(openAssessmentMenu === assess.id ? null : assess.id); }}>⋮</div></div></div>
                                      <div className="assess-date">{assess.date}</div>
                                      <div className="assess-time">Studied: {formatTime(assess.calculatedTime || 0)}</div>
                                      {openAssessmentMenu === assess.id && (<div className="assess-dropdown"><div onClick={() => startEditingAssessment(assess)}>Edit</div><div onClick={() => handleDeleteAssessment(assess.id)} className="delete-option">Delete</div></div>)}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="management-container sidebar-style">
                        <div className="management-header" onClick={() => setShowManageClasses(!showManageClasses)}><h3>Manage Classes</h3><span className="toggle-icon">{showManageClasses ? "▲" : "▼"}</span></div>
                        {showManageClasses && (<div className="management-content">{!viewingArchived && (<div className="add-subject-col"><input type="text" placeholder="New Class Name" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()} /><button onClick={handleAddSubject} className="btn-full-width">Add Class</button></div>)}<div className="subject-list">{subjects.map(sub => <span key={sub.id} className="subject-tag">{sub.name} {!viewingArchived && <button onClick={() => handleDeleteSubject(sub.id)} className="x-btn">x</button>}</span>)}</div></div>)}
                      </div>
                    </div>
                  </>
              )}

              {/* --- ANALYTICS --- */}
              {activeView === 'analytics' && (
                  <div className="analytics-container-col">
                      {!selectedSubjectId ? <div className="empty-chart-msg">Please select a class.</div> : (
                          <>
                            {/* Analytics Header with Filter Toggles */}
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                                <h3 style={{margin:0}}>Analytics</h3>
                                <div className="filter-row" style={{justifyContent:'flex-end'}}>
                                    <small style={{marginRight:'5px'}}>Filter:</small>
                                    {assignmentTypes.map(t => (
                                        <span key={t} className={`filter-badge ${visibleTypes[t] ? 'active-filter' : ''}`} onClick={() => toggleTypeVisibility(t)}>
                                            {t}
                                        </span>
                                    ))}
                                    {assignmentTypes.length === 0 && <small style={{fontStyle:'italic', opacity:0.6}}>No categories</small>}
                                </div>
                            </div>

                            <div className="metrics-row"><div className="metric-card"><h4>Avg. Efficiency</h4><p>{avgEfficiency} <span style={{fontSize:'1rem'}}>pts/hr</span></p></div></div>
                            <div className="chart-wrapper"><h3>Correlation</h3><ResponsiveContainer width="100%" height={250}><ScatterChart margin={{top:20,right:20,bottom:20,left:20}}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="x" name="Hours"/><YAxis type="number" dataKey="y" name="Grade"/><Tooltip cursor={{strokeDasharray:'3 3'}}/><Scatter name="Assignments" data={scatterData} fill={primaryColor}/></ScatterChart></ResponsiveContainer></div>
                            <div className="chart-wrapper"><h3>Efficiency</h3><ResponsiveContainer width="100%" height={250}><BarChart data={efficiencyData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis/><Tooltip/><Legend/><Bar dataKey="efficiency" fill="#82ca9d"/></BarChart></ResponsiveContainer></div>
                          </>
                      )}
                  </div>
              )}

              {/* --- CALCULATOR --- */}
              {activeView === 'calculator' && (
                  <div className="calculator-container">
                      {!selectedSubjectId ? <div className="empty-chart-msg">Please select a class.</div> : (
                          <>
                            {/* 1. CONFIGURATION */}
                            <div className="calc-card">
                                <h3>Assignment Types & Weights</h3>
                                <div className="add-type-row"><input placeholder="New Category (e.g. Lab)" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} /><button onClick={handleAddType} className="btn-small">Add</button></div>
                                <div className="weights-grid">
                                    <div className="weight-row" style={{fontWeight:'bold', fontSize:'0.8rem', opacity:0.7, borderBottom:'1px solid rgba(255,255,255,0.1)', paddingBottom:'5px'}}>
                                        <span>Category</span>
                                        <span>Weight (%)</span>
                                        <span>Qty Left</span>
                                    </div>
                                    {assignmentTypes.map(type => (
                                        <div key={type} className="weight-input-group">
                                            {renamingType === type ? (
                                                <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                                    <input value={tempRenamingName} onChange={(e) => setTempRenamingName(e.target.value)} className="rename-input" autoFocus style={{width:'100%'}}/>
                                                    <button onClick={() => submitRenameType(type)} className="btn-small" style={{background:'#4CAF50', padding:'2px 5px'}}>✓</button>
                                                    <button onClick={cancelRenameType} className="btn-small" style={{background:'#f44336', padding:'2px 5px'}}>✕</button>
                                                </div>
                                            ) : (
                                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative'}}>
                                                    <label>{type}</label>
                                                    <div className="type-menu-trigger" onClick={(e) => { e.stopPropagation(); setOpenTypeMenu(openTypeMenu === type ? null : type); }}>⋮</div>
                                                    {openTypeMenu === type && (
                                                        <div className="type-dropdown">
                                                            <div onClick={() => startRenamingType(type)}>Rename</div>
                                                            <div onClick={() => handleDeleteType(type)} className="delete-option">Delete</div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <input type="number" placeholder="%" value={weights[type] || ""} onChange={(e) => setWeights({...weights, [type]: parseFloat(e.target.value)})} />
                                            <input type="number" placeholder="#" value={remainingItems[type] || ""} onChange={(e) => setRemainingItems({...remainingItems, [type]: parseFloat(e.target.value)})} />
                                        </div>
                                    ))}
                                </div>
                                <button className="btn-small" onClick={() => handleSaveConfig()}>Save Configuration</button>
                            </div>

                            {/* 2. ENTER GRADES */}
                            <div className="calc-card">
                                <h3>Grades</h3>
                                <div className="sidebar-form row-form">
                                    <input placeholder="Name" value={newGradeEntry.name} onChange={e => setNewGradeEntry({...newGradeEntry, name: e.target.value})} />
                                    <input placeholder="Score" type="number" style={{width:'60px'}} value={newGradeEntry.score} onChange={e => setNewGradeEntry({...newGradeEntry, score: e.target.value})} />
                                    <span style={{color:'white'}}>/</span>
                                    <input placeholder="Total" type="number" style={{width:'60px'}} value={newGradeEntry.totalPoints} onChange={e => setNewGradeEntry({...newGradeEntry, totalPoints: e.target.value})} />
                                    <select value={newGradeEntry.category} onChange={e => setNewGradeEntry({...newGradeEntry, category: e.target.value})}>{assignmentTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                    <button onClick={handleAddGrade} className="btn-small">Add</button>
                                </div>
                                
                                <div className="grades-list">
                                    {/* Manual Entries List */}
                                    {gradeEntries.map(g => (
                                        editingGradeId === g.id ? (
                                            <div key={g.id} className="grade-item editing-row">
                                                <div style={{display:'flex', gap:'5px', width:'100%', minWidth: 0}}>
                                                    <select value={editGradeData.category} onChange={e=>setEditGradeData({...editGradeData, category:e.target.value})} style={{width:'100px', flexShrink:0, padding:'2px'}}>
                                                        {assignmentTypes.map(t=><option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                    <input value={editGradeData.name} onChange={e=>setEditGradeData({...editGradeData, name:e.target.value})} placeholder="Name" style={{flexGrow:1, minWidth:'80px', padding:'4px'}}/>
                                                </div>
                                                <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'2px'}}>
                                                    <input value={editGradeData.score} onChange={e=>setEditGradeData({...editGradeData, score:e.target.value})} style={{width:'35px', textAlign:'center', padding:'4px'}}/> 
                                                    <span style={{opacity:0.5}}>/</span> 
                                                    <input value={editGradeData.totalPoints} onChange={e=>setEditGradeData({...editGradeData, totalPoints:e.target.value})} style={{width:'35px', textAlign:'center', padding:'4px', marginRight:'15px'}}/>
                                                </div>
                                                <div style={{display:'flex', gap:'4px', justifyContent:'end'}}>
                                                    <button onClick={saveEditedGradeList} className="btn-small" style={{background:'#4CAF50', padding:'4px 8px', minWidth:'25px'}}>✓</button>
                                                    <button onClick={cancelEditGradeList} className="btn-small" style={{background:'#f44336', padding:'4px 8px', minWidth:'25px'}}>✕</button>
                                                    <button onClick={handleDeleteFromEdit} className="btn-small" style={{background:'#ff4d4d', padding:'4px 8px', minWidth:'25px'}}>🗑</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div key={g.id} className="grade-item">
                                                <span>{g.category}: {g.name}</span>
                                                <span>{g.score}/{g.totalPoints}</span>
                                                <button onClick={()=>startEditingGradeList(g, 'manual')} className="x-btn" style={{color:'#aaa', justifySelf:'end'}}>⋮</button>
                                            </div>
                                        )
                                    ))}

                                    {/* Tracker Entries List */}
                                    {assessments.map(assess => (
                                        editingGradeId === assess.id ? (
                                            <div key={`tracker-edit-${assess.id}`} className="grade-item editing-row">
                                                <div style={{display:'flex', gap:'5px', width:'100%', minWidth: 0}}>
                                                    <select value={editGradeData.category} onChange={e=>setEditGradeData({...editGradeData, category:e.target.value})} style={{width:'100px', flexShrink:0, padding:'2px'}}>
                                                        {assignmentTypes.map(t=><option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                    <input value={editGradeData.name} onChange={e=>setEditGradeData({...editGradeData, name:e.target.value})} style={{flexGrow:1, minWidth:'80px', padding:'4px'}}/>
                                                </div>
                                                <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'2px'}}>
                                                    <input value={editGradeData.score} onChange={e=>setEditGradeData({...editGradeData, score:e.target.value})} style={{width:'35px', textAlign:'center', padding:'4px'}}/> 
                                                    <span style={{opacity:0.5}}>/</span> 
                                                    <input value={editGradeData.totalPoints} onChange={e=>setEditGradeData({...editGradeData, totalPoints:e.target.value})} style={{width:'35px', textAlign:'center', padding:'4px', marginRight:'15px'}}/>
                                                </div>
                                                <div style={{display:'flex', gap:'4px', justifyContent:'end'}}>
                                                    <button onClick={saveEditedGradeList} className="btn-small" style={{background:'#4CAF50', padding:'4px 8px', minWidth:'25px'}}>✓</button>
                                                    <button onClick={cancelEditGradeList} className="btn-small" style={{background:'#f44336', padding:'4px 8px', minWidth:'25px'}}>✕</button>
                                                    <button onClick={handleDeleteFromEdit} className="btn-small" style={{background:'#ff4d4d', padding:'4px 8px', minWidth:'25px'}}>🗑</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div key={`tracker-${assess.id}`} className="grade-item tracker-grade">
                                                <span>{assess.name} <span style={{fontSize:'0.8rem', opacity:0.7}}>({assess.type})</span></span>
                                                <span>{assess.grade || 0}/100</span>
                                                <button onClick={()=>startEditingGradeList(assess, 'tracker')} className="x-btn" style={{color:'#aaa', justifySelf:'end'}}>⋮</button>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>

                            {/* 3. RESULTS */}
                            <div className="calc-card result-card">
                                <h3>Predictive Engine</h3>
                                <div className="prediction-input"><label>Desired Grade:</label><input type="number" value={targetGrade} onChange={e => setTargetGrade(e.target.value)} /><span>%</span></div>
                                {calculationResult && (
                                    <div className="results-display">
                                        <div className="res-row"><span>Current Grade (Normalized):</span><span className="highlight">{calculationResult.currentGrade}%</span></div>
                                        <div className="results-actions" style={{textAlign: 'right', marginBottom: '5px'}}>
                                            <small style={{cursor:'pointer', color:'#aaa'}} onClick={()=>setShowAbsolute(!showAbsolute)}>{showAbsolute ? 'Hide' : 'Show'} Absolute Avg</small>
                                        </div>
                                        {showAbsolute && (
                                            <div className="res-row"><span>Current Average (Absolute):</span><span className="highlight" style={{color:'#ddd'}}>{calculationResult.absoluteAverage}%</span></div>
                                        )}
                                        <div style={{margin:'15px 0', borderTop:'1px solid rgba(255,255,255,0.1)'}}></div>
                                        <div className="res-row"><span>Required Score (Remaining {calculationResult.remainingWeight}%):</span><span className="highlight" style={{color: calculationResult.requiredScore > 100 ? '#ff4d4d' : primaryColor}}>{calculationResult.requiredScore}%</span></div>
                                        <div className="study-prediction"><h4>Time Prediction</h4>{calculationResult.hasRegression ? (
                                            <div>
                                                <p>Estimated study time needed:<br/><span className="giant-text">{calculationResult.totalPredictedHours} Hours</span></p>
                                                <small style={{opacity:0.7}}>({calculationResult.predictedHoursPerItem} hrs/item for {calculationResult.totalItemsLeft} items)</small>
                                            </div>
                                        ) : (<p style={{opacity:0.7}}>Not enough data to predict time.</p>)}</div>
                                    </div>
                                )}
                            </div>
                          </>
                      )}
                  </div>
              )}

              {/* --- CALENDAR --- */}
              {activeView === 'calendar' && (
                  <div className="calendar-container">
                      <div className="calendar-header">
                          <button className="btn-small" onClick={() => changeMonth(-1)}>&lt; Prev</button>
                          <h3>{currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}</h3>
                          <button className="btn-small" onClick={() => changeMonth(1)}>Next &gt;</button>
                      </div>
                      <div className="calendar-grid">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                              <div key={d} className="cal-day-header">{d}</div>
                          ))}
                          {getCalendarCells().map((cell, index) => (
                              <div 
                                  key={cell.key} 
                                  className="cal-day" 
                                  style={{
                                      backgroundColor: cell.type === 'day' ? getIntensityColor(cell.seconds) : 'transparent',
                                      opacity: cell.type === 'empty' ? 0 : 1
                                  }}
                              >
                                  {cell.type === 'day' && (
                                      <>
                                          <span>{cell.day}</span>
                                          {cell.seconds > 0 && (
                                              <span className="cal-tooltip">{cell.hours} hrs</span>
                                          )}
                                      </>
                                  )}
                              </div>
                          ))}
                      </div>
                      <div style={{marginTop:'20px', display:'flex', alignItems:'center', gap:'10px', fontSize:'0.8rem', opacity:0.7}}>
                          <span>Less</span>
                          <div style={{width:'15px', height:'15px', background:'rgba(255,255,255,0.05)', borderRadius:'3px'}}></div>
                          <div style={{width:'15px', height:'15px', background: getIntensityColor(1800), borderRadius:'3px'}}></div>
                          <div style={{width:'15px', height:'15px', background: getIntensityColor(7200), borderRadius:'3px'}}></div>
                          <div style={{width:'15px', height:'15px', background: getIntensityColor(14400), borderRadius:'3px'}}></div>
                          <div style={{width:'15px', height:'15px', background: getIntensityColor(22000), borderRadius:'3px'}}></div>
                          <span>More</span>
                      </div>
                  </div>
              )}

            </div>
          </>
        )}
      </header>
    </div>
  );
}

export default App;