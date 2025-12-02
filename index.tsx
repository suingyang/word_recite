
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  Volume2, 
  Menu, 
  X, 
  Upload, 
  ChevronRight, 
  Award,
  Loader2,
  Languages,
  Trash2,
  Play,
  Square,
  PauseCircle
} from 'lucide-react';

// --- Types ---

type WordItem = {
  id: string;
  word: string;
  pos: string; // Part of speech (e.g., n., adj.)
  replacement: string; // Synonyms
  translation: string; // Chinese meaning
  learned: boolean;
};

type DaySheet = {
  id: string;
  name: string;
  words: WordItem[];
};

// --- Initial Mock Data ---

const INITIAL_DATA: DaySheet[] = [
  {
    id: 'day-1',
    name: 'Day 1: Demo',
    words: [
      { 
        id: 'd1-1', 
        word: 'Resilience', 
        pos: 'n.', 
        replacement: 'elasticity, recovery, flexibility', 
        translation: '弹性；恢复力', 
        learned: false 
      },
      { 
        id: 'd1-2', 
        word: 'Sedentary', 
        pos: 'adj.', 
        replacement: 'inactive, desk-bound, motionless', 
        translation: '久坐不动的；缺乏活动的', 
        learned: false 
      },
      { 
        id: 'd1-3', 
        word: 'Longevity', 
        pos: 'n.', 
        replacement: 'long life, life span, durability', 
        translation: '长寿；寿命', 
        learned: false 
      },
    ]
  }
];

// --- Components ---

const App = () => {
  const [sheets, setSheets] = useState<DaySheet[]>(INITIAL_DATA);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  
  // Audio State
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  
  // Refs for audio control
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingSequenceRef = useRef(false);

  // Stats
  const activeSheet = sheets[activeSheetIndex];
  const totalWords = activeSheet?.words.length || 0;
  const learnedWords = activeSheet?.words.filter(w => w.learned).length || 0;
  const progress = totalWords === 0 ? 0 : Math.round((learnedWords / totalWords) * 100);

  // Toggle Learned Status
  const toggleLearned = (wordId: string) => {
    setSheets(prevSheets => {
      const newSheets = [...prevSheets];
      const sheet = newSheets[activeSheetIndex];
      const wordIndex = sheet.words.findIndex(w => w.id === wordId);
      if (wordIndex !== -1) {
        sheet.words[wordIndex].learned = !sheet.words[wordIndex].learned;
      }
      return newSheets;
    });
  };

  // Delete Sheet
  const deleteSheet = (sheetId: string, index: number) => {
    // Stop any playing audio before deleting
    stopAudio();

    const sheetToDelete = sheets.find(s => s.id === sheetId);
    if (!sheetToDelete) return;

    if (window.confirm(`Are you sure you want to delete "${sheetToDelete.name}"?`)) {
      const newSheets = sheets.filter(s => s.id !== sheetId);
      setSheets(newSheets);

      // Adjust active index
      if (newSheets.length === 0) {
        setActiveSheetIndex(0);
      } else if (index === activeSheetIndex) {
        // If deleting the active one, go to the previous one or 0
        setActiveSheetIndex(Math.max(0, index - 1));
      } else if (index < activeSheetIndex) {
        // If deleting one before the active one, shift index down
        setActiveSheetIndex(activeSheetIndex - 1);
      }
    }
  };

  // Stop Audio helper
  const stopAudio = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setPlayingWordId(null);
    isPlayingSequenceRef.current = false;
    setIsPlayingSequence(false);
  };

  // Play Single Word Audio (Returns promise for chaining)
  const playWordAudio = async (wordItem: WordItem, isSequence = false): Promise<void> => {
    // If manually playing, stop any existing sequence/audio
    if (!isSequence) {
      stopAudio();
    }

    setPlayingWordId(wordItem.id);

    return new Promise<void>((resolve) => {
      // 1. Construct text to say
      const textToSay = `${wordItem.word}. ${wordItem.replacement || ''}`;
      
      // 2. Construct Google Translate TTS URL
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(textToSay)}`;

      const audio = new Audio(url);
      activeAudioRef.current = audio;

      // Handle playback end
      audio.onended = () => {
        setPlayingWordId((currentId) => currentId === wordItem.id ? null : currentId);
        resolve();
      };

      // Handle errors (e.g., network issues)
      audio.onerror = (e) => {
        console.error("Audio playback error", e);
        setPlayingWordId((currentId) => currentId === wordItem.id ? null : currentId);
        resolve(); // Resolve anyway to keep sequence moving if in a playlist
      };

      // Start playback
      audio.play().catch(err => {
        console.error("Play failed", err);
        setPlayingWordId(null);
        resolve();
      });
    });
  };

  // Play All Handler
  const handlePlayAll = async () => {
    if (isPlayingSequence) {
      stopAudio();
      return;
    }

    if (!activeSheet?.words.length) return;

    setIsPlayingSequence(true);
    isPlayingSequenceRef.current = true;

    for (const word of activeSheet.words) {
      if (!isPlayingSequenceRef.current) break;

      // Scroll card into view
      const card = document.getElementById(`word-card-${word.id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      await playWordAudio(word, true);

      // Small pause between words for natural flow
      if (isPlayingSequenceRef.current) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    setIsPlayingSequence(false);
    isPlayingSequenceRef.current = false;
    setPlayingWordId(null);
  };

  // Import Handler
  const handleImport = () => {
    if (!importText.trim()) return;

    const lines = importText.trim().split('\n');
    const parsedWords: WordItem[] = [];
    
    lines.forEach((line, idx) => {
      const parts = line.split(/\t/);
      
      if (parts.length >= 1 && parts[0].trim()) {
        parsedWords.push({
          id: `imp-${Date.now()}-${idx}`,
          word: parts[0].trim(),
          pos: parts[1]?.trim() || '',
          replacement: parts[2]?.trim() || '',
          translation: parts[3]?.trim() || '',
          learned: false
        });
      }
    });

    if (parsedWords.length > 0) {
      const nextDayNumber = sheets.length + 1;
      const newSheet: DaySheet = {
        id: `imported-day-${Date.now()}`,
        name: `Day ${nextDayNumber}`,
        words: parsedWords
      };

      setSheets([...sheets, newSheet]);
      setActiveSheetIndex(sheets.length); 
      setShowImportModal(false);
      setImportText('');
    } else {
      alert("Could not parse data. Ensure format matches the example.");
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-slate-800 overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <BookOpen className="w-6 h-6" />
            <span className="font-bold text-xl tracking-tight">VocabMaster</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Daily Tasks</h3>
          {sheets.map((sheet, idx) => (
            <div
              key={sheet.id}
              className={`
                w-full rounded-xl transition-all duration-200 flex items-center group
                ${activeSheetIndex === idx 
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' 
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {/* Select Sheet Area */}
              <div 
                onClick={() => {
                  setActiveSheetIndex(idx);
                  setIsSidebarOpen(false);
                }}
                className="flex-1 px-4 py-3 cursor-pointer flex items-center justify-between overflow-hidden"
              >
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate font-medium">{sheet.name}</span>
                  <span className="text-xs text-gray-400 font-normal mt-0.5">{sheet.words.length} words</span>
                </div>
                {activeSheetIndex === idx && (
                  <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0 ml-2" />
                )}
              </div>
              
              {/* Delete Button Area (Sibling) */}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Double safety
                  deleteSheet(sheet.id, idx);
                }}
                className={`
                  p-3 rounded-r-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0
                  ${activeSheetIndex === idx ? 'hover:bg-red-100' : ''}
                  md:opacity-0 md:group-hover:opacity-100 opacity-100
                `}
                title="Delete Day"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {sheets.length === 0 && (
            <div className="text-center py-8 px-4 text-gray-400 text-sm">
              <p>No days available.</p>
              <p className="text-xs mt-1">Import some words to get started!</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={() => setShowImportModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
          >
            <Upload className="w-4 h-4" />
            <span>Import Sheet</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {sheets.length === 0 ? (
           // Empty State
           <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                <Upload className="w-10 h-10 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Ready to learn?</h2>
              <p className="text-gray-500 max-w-sm mb-8">
                You don't have any daily tasks yet. Import your vocabulary list to generate your first study day.
              </p>
              <button 
                onClick={() => setShowImportModal(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium shadow-lg shadow-indigo-200 transition-all transform hover:scale-105"
              >
                Import Vocabulary
              </button>
           </div>
        ) : (
          <>
            {/* Header */}
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg md:hidden"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold text-slate-800 truncate max-w-[140px] sm:max-w-md">
                  {activeSheet?.name}
                </h1>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-6">
                {/* Play All Button */}
                <button
                  onClick={handlePlayAll}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all shadow-sm
                    ${isPlayingSequence 
                      ? 'bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100' 
                      : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-100'
                    }
                  `}
                >
                  {isPlayingSequence ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      <span className="hidden sm:inline">Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span className="hidden sm:inline">Play All</span>
                    </>
                  )}
                </button>

                 <div className="flex items-center gap-3">
                   <div className="hidden sm:flex flex-col items-end">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</span>
                      <span className="text-sm font-bold text-indigo-600">{learnedWords} / {totalWords}</span>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 relative">
                      <Award className="w-5 h-5" />
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-indigo-100"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <path
                          className="text-indigo-600 transition-all duration-500 ease-out"
                          strokeDasharray={`${progress}, 100`}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                      </svg>
                   </div>
                 </div>
              </div>
            </header>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50">
              <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                {activeSheet?.words.map((word) => (
                  <div 
                    key={word.id}
                    id={`word-card-${word.id}`}
                    className={`
                      relative bg-white rounded-2xl p-5 border transition-all duration-300 group flex flex-col
                      ${playingWordId === word.id ? 'ring-2 ring-indigo-500 shadow-xl scale-[1.02] z-10' : ''}
                      ${word.learned 
                        ? 'border-green-200 bg-green-50/30' 
                        : 'border-gray-200 hover:border-indigo-300 hover:shadow-lg'
                      }
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                       <div className="flex items-baseline gap-2">
                         <h2 className={`text-2xl font-bold tracking-tight ${word.learned ? 'text-green-800' : 'text-slate-800'}`}>
                           {word.word}
                         </h2>
                         {word.pos && (
                           <span className="text-sm italic font-serif text-gray-400">
                             {word.pos}
                           </span>
                         )}
                       </div>
                       <button
                        onClick={() => toggleLearned(word.id)}
                        className={`
                          p-1.5 rounded-full transition-colors flex-shrink-0 ml-2
                          ${word.learned 
                            ? 'text-green-600 bg-green-100 hover:bg-green-200' 
                            : 'text-gray-300 hover:text-green-500 hover:bg-green-50'
                          }
                        `}
                       >
                         {word.learned ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                       </button>
                    </div>

                    {word.translation && (
                      <div className="flex items-center gap-2 mb-3">
                        <Languages className="w-3 h-3 text-indigo-400" />
                        <p className={`text-sm font-medium ${word.learned ? 'text-green-700' : 'text-slate-600'}`}>
                          {word.translation}
                        </p>
                      </div>
                    )}

                    {word.replacement && (
                      <div className="mt-auto bg-gray-50/80 rounded-lg p-3 border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Synonyms</span>
                        <p className="text-sm text-slate-500 leading-snug">
                          {word.replacement}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                       <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        {word.learned ? 'Learned' : 'Study'}
                      </span>
                      
                      <button 
                        onClick={() => playWordAudio(word, false)}
                        disabled={playingWordId !== null && playingWordId !== word.id && !isPlayingSequence}
                        className={`
                          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                          ${playingWordId === word.id 
                            ? 'bg-indigo-100 text-indigo-600' 
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100'
                          }
                        `}
                      >
                        {playingWordId === word.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Playing...</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-4 h-4" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
                
                {activeSheet?.words.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400">
                     <BookOpen className="w-12 h-12 mb-4 opacity-20" />
                     <p>No words found for this day.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-slate-800">Import Vocabulary</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="mb-4 bg-blue-50 text-blue-800 p-4 rounded-lg text-sm">
                <strong>Format:</strong> Copy columns from Excel/Sheets directly. 
                <br/>
                We expect: <code>Word</code> → <code>Part of Speech</code> → <code>Synonyms</code> → <code>Translation</code>.
                <br/>
                <span className="text-blue-600/80 mt-1 block">All imported words will be grouped into a single new 'Day'.</span>
              </div>
              
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`resilience\tn.\telasticity, recovery\t弹性；恢复力\nsedentary\tadj.\tinactive, desk-bound\t久坐不动的`}
                className="w-full h-64 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-xs sm:text-sm bg-gray-50 whitespace-pre"
              />
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleImport}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-md shadow-indigo-200 transition-colors"
              >
                Create Day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
