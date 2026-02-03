import React, { useEffect, useState, useCallback, useMemo } from 'react';
import FeedColumn from './components/FeedColumn';
import { BANGLADESH_XML, UK_XML } from './data/sampleFeeds';
import { parseTrendsXML } from './utils/xmlParser';
import { TrendItem } from './types';
import { RefreshCw, TrendingUp, Clock, Wifi, WifiOff, AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  const [bdTrends, setBdTrends] = useState<TrendItem[]>([]);
  const [ukTrends, setUkTrends] = useState<TrendItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Mobile View State
  const [activeTab, setActiveTab] = useState<'bd' | 'uk'>('bd');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // State for Logo visibility to save space on mobile
  const [showLogo, setShowLogo] = useState(true);

  // Auto-hide logo after 3 seconds to save space
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLogo(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Helper to fetch RSS data using multiple CORS proxies for redundancy
  const fetchFeed = async (geo: string) => {
    const RSS_URL = `https://trends.google.com/trending/rss?geo=${geo}`;
    
    // Array of proxy services to try in order
    // We rotate through these to avoid rate limits or downtime on a single service
    const proxyGenerators = [
      // Primary: AllOrigins (usually reliable)
      (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      // Backup 1: CORSProxy.io
      (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
      // Backup 2: CodeTabs
      (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];

    for (const generateUrl of proxyGenerators) {
      try {
        const proxyUrl = generateUrl(RSS_URL);
        const response = await fetch(proxyUrl);
        
        if (response.ok) {
          const text = await response.text();
          // Basic validation to ensure we received XML content, not an HTML error page
          if (text.includes('<rss') || text.includes('<?xml')) {
            return text;
          }
        }
      } catch (err) {
        console.warn(`Proxy attempt failed for ${geo}:`, err);
        // Continue to next proxy in the list
      }
    }

    throw new Error(`Unable to reach Google Trends for ${geo} via any available proxy.`);
  };

  // Load and parse data
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setShowLogo(true); // Temporarily show logo on refresh for feedback
    
    try {
      // Attempt to fetch live data
      const [bdXml, ukXml] = await Promise.all([
        fetchFeed('BD'),
        fetchFeed('GB')
      ]);

      const parsedBd = parseTrendsXML(bdXml);
      const parsedUk = parseTrendsXML(ukXml);

      if (parsedBd.length > 0 && parsedUk.length > 0) {
        setBdTrends(parsedBd);
        setUkTrends(parsedUk);
        setIsLive(true);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        throw new Error("Parsed data was empty");
      }

    } catch (error) {
      console.warn("Live fetch failed, falling back to sample data", error);
      
      // Fallback to sample data if proxy/network fails
      setBdTrends(parseTrendsXML(BANGLADESH_XML));
      setUkTrends(parseTrendsXML(UK_XML));
      setIsLive(false); // Mark as offline/cached data
      setLastUpdated(new Date().toLocaleTimeString());
      setErrorMessage("Live connection failed. Displaying cached data. Please try again later.");
      
    } finally {
      setLoading(false);
      // Restart hide timer after refresh
      setTimeout(() => setShowLogo(false), 3000);
    }
  }, []);

  useEffect(() => {
    // Initial load immediately
    loadData();

    // Auto-refresh every 15 minutes (15 * 60 * 1000 ms)
    const intervalId = setInterval(() => {
      loadData();
    }, 15 * 60 * 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [loadData]);

  // Sorting Logic
  const sortTrends = useCallback((items: TrendItem[]) => {
    return [...items].sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime() || 0;
      const dateB = new Date(b.pubDate).getTime() || 0;
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [sortOrder]);

  const sortedBdTrends = useMemo(() => sortTrends(bdTrends), [bdTrends, sortTrends]);
  const sortedUkTrends = useMemo(() => sortTrends(ukTrends), [ukTrends, sortTrends]);

  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  // Swipe Handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); // Reset
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && activeTab === 'bd') {
      setActiveTab('uk');
    }
    if (isRightSwipe && activeTab === 'uk') {
      setActiveTab('bd');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      
      {/* Header */}
      <header 
        className={`bg-white border-b border-slate-200 shrink-0 z-50 shadow-sm transition-all duration-500 overflow-hidden ${showLogo ? 'py-3' : 'py-2'}`}
        onClick={() => !showLogo && setShowLogo(true)} // Tap header to show logo again
      >
        <div className="px-4 max-w-7xl mx-auto flex flex-row justify-between items-center gap-4">
          
          {/* Logo Section - Collapsible */}
          <div className={`flex items-center gap-2 transition-all duration-700 ease-in-out ${showLogo ? 'opacity-100 max-w-xs translate-x-0' : 'opacity-0 max-w-0 -translate-x-10'}`}>
            <div className="bg-[#181840] p-2 rounded-lg shadow-sm whitespace-nowrap shrink-0">
              <TrendingUp size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#181840] whitespace-nowrap">
              Trend Spotting
            </h1>
          </div>

          {/* Controls - Always Visible but compact on mobile */}
          <div className="flex items-center gap-2 sm:gap-4 text-sm ml-auto">
             <div 
               className={`hidden sm:flex items-center gap-2 border py-1.5 px-3 rounded-full transition-colors ${isLive ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}
               title={isLive ? "Connected to Google Trends Live Feed" : "Connection to Live Feed failed. Showing cached data."}
             >
               {isLive ? <Wifi size={14} /> : <WifiOff size={14} />}
               <span>{isLive ? 'Live Feed' : 'Offline Mode'}</span>
             </div>

             <div className="hidden sm:flex items-center gap-2 text-slate-500 bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-full">
               <Clock size={14} />
               <span>Auto: 15m</span>
             </div>

            <div className="h-6 w-px bg-slate-300 hidden sm:block"></div>

            <button
              onClick={(e) => { e.stopPropagation(); toggleSort(); }}
              className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-md transition-all active:scale-95 border border-slate-300 shadow-sm"
              title={`Sort by Date: ${sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}`}
            >
              <ArrowUpDown size={16} />
              <span className="hidden sm:inline">{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); loadData(); }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-md transition-all active:scale-95 disabled:opacity-50 border border-slate-300 shadow-sm"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{loading ? "Syncing..." : "Refresh"}</span>
              <span className="sm:hidden">Sync</span>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-amber-50 border-t border-amber-200 py-2 px-4 mt-2">
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-xs sm:text-sm text-amber-800 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Tab Navigation - Hidden on Desktop */}
      <div className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="grid grid-cols-2">
          <button 
            onClick={() => setActiveTab('bd')}
            className={`p-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'bd' ? 'border-[#181840] text-[#181840]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Bangladesh
          </button>
          <button 
            onClick={() => setActiveTab('uk')}
            className={`p-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'uk' ? 'border-[#181840] text-[#181840]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            United Kingdom
          </button>
        </div>
        {/* Swipe Hint */}
        <div className="bg-slate-50 text-[10px] text-slate-400 text-center py-1 flex items-center justify-center gap-1">
          <ChevronLeft size={10} />
          <span>Swipe to switch</span>
          <ChevronRight size={10} />
        </div>
      </div>

      {/* Main Content */}
      <main 
        className="flex-1 overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="max-w-7xl mx-auto h-full">
           {/* Grid Layout: Desktop Side-by-Side (grid-cols-2), Mobile Full Width Single Column */}
           <div className="h-full md:grid md:grid-cols-2 md:divide-x divide-slate-200">
             
             {/* Bangladesh Column - Hidden on mobile if not active */}
             <div className={`h-full overflow-hidden ${activeTab === 'bd' ? 'block' : 'hidden'} md:block`}>
                <FeedColumn 
                  countryName="Bangladesh" 
                  flagCode="bd" 
                  items={sortedBdTrends} 
                />
             </div>

             {/* UK Column - Hidden on mobile if not active */}
             <div className={`h-full overflow-hidden ${activeTab === 'uk' ? 'block' : 'hidden'} md:block`}>
                <FeedColumn 
                  countryName="United Kingdom" 
                  flagCode="gb" 
                  items={sortedUkTrends} 
                />
             </div>

           </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="p-3 text-center text-xs text-slate-500 border-t border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-center gap-2 shrink-0 z-10">
         <div className="flex items-center gap-2 order-2 sm:order-1">
          <span>Last synced: {lastUpdated}</span>
          <span className="w-1 h-1 rounded-full bg-slate-400"></span>
          <span className={isLive ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>{isLive ? "Live" : "Offline"}</span>
        </div>
        <div className="order-1 sm:order-2 font-medium text-slate-400">
          Developed by N Reza
        </div>
      </footer>

    </div>
  );
};

export default App;