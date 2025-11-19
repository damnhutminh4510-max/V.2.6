import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Page, PersonalInfo, Experience as ExperienceType, Project, Certificate, ThemeSettings, SkillCategory } from './types';
import Header from './components/Header';
import Footer from './components/Footer';
import Introduction from './pages/Introduction';
import Experience from './pages/Experience';
import Projects from './pages/Projects';
import Certifications from './pages/Certifications';
import Skills from './pages/Skills';
import Settings from './pages/Settings';
import ProjectDetail from './pages/ProjectDetail';
import MusicPlayer from './components/MusicPlayer';
import Login from './pages/Login';
import SiteLockModal from './components/SiteLockModal';
import LoadingSpinner from './components/LoadingSpinner';
import { firestore, firebaseInitializationError } from './firebase';
import Lightbox from './components/Lightbox';
import { LanguageProvider, useLanguage } from './LanguageContext';


import { 
  PERSONAL_INFO_VI, WORK_EXPERIENCE_VI, PROJECTS_VI, CERTIFICATIONS_VI, SKILLS_DATA_VI,
  PERSONAL_INFO_EN, WORK_EXPERIENCE_EN, PROJECTS_EN, CERTIFICATIONS_EN, SKILLS_DATA_EN,
  INITIAL_THEME_SETTINGS 
} from './constants';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Introduction);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSiteUnlocked, setIsSiteUnlocked] = useState(false);

  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>(PERSONAL_INFO_VI);
  const [workExperience, setWorkExperience] = useState<ExperienceType[]>(WORK_EXPERIENCE_VI);
  const [projects, setProjects] = useState<Project[]>(PROJECTS_VI);
  const [certifications, setCertifications] = useState<Certificate[]>(CERTIFICATIONS_VI);
  const [skills, setSkills] = useState<SkillCategory[]>(SKILLS_DATA_VI);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(INITIAL_THEME_SETTINGS);

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(firebaseInitializationError);
  
  const { language } = useLanguage();

  useEffect(() => {
    if (language === 'vi') {
        setPersonalInfo(prev => ({...prev, ...PERSONAL_INFO_VI}));
        setWorkExperience(WORK_EXPERIENCE_VI);
        setProjects(PROJECTS_VI);
        setCertifications(CERTIFICATIONS_VI);
        setSkills(SKILLS_DATA_VI);
    } else {
        setPersonalInfo(prev => ({...prev, ...PERSONAL_INFO_EN}));
        setWorkExperience(WORK_EXPERIENCE_EN);
        setProjects(PROJECTS_EN);
        setCertifications(CERTIFICATIONS_EN);
        setSkills(SKILLS_DATA_EN);
    }
  }, [language]);


  // Simple debounce function
  const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>): void => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => func(...args), waitFor);
    };
  };

  // Load state from Firestore on initial render
  useEffect(() => {
    if (!firestore) {
        console.warn("Firestore is not initialized. Running in local mode with default data.");
        setIsLoading(false);
        return;
    }

    const docRef = firestore.collection('portfolio').doc('data');

    const fetchData = async () => {
      try {
        const doc = await docRef.get();
        if (doc.exists) {
          const data = doc.data();
          if (data) {
             const basePersonalInfo = language === 'vi' ? PERSONAL_INFO_VI : PERSONAL_INFO_EN;
             const baseWorkExperience = language === 'vi' ? WORK_EXPERIENCE_VI : WORK_EXPERIENCE_EN;
             const baseProjects = language === 'vi' ? PROJECTS_VI : PROJECTS_EN;
             const baseCertifications = language === 'vi' ? CERTIFICATIONS_VI : CERTIFICATIONS_EN;
             const baseSkills = language === 'vi' ? SKILLS_DATA_VI : SKILLS_DATA_EN;

            setPersonalInfo({ ...basePersonalInfo, ...(data.personalInfo || {}) });
            setWorkExperience(data.workExperience || baseWorkExperience);
            setProjects(data.projects || baseProjects);
            setCertifications(data.certifications || baseCertifications);
            setSkills(data.skills || baseSkills);
            setThemeSettings({ ...INITIAL_THEME_SETTINGS, ...(data.themeSettings || {}) });
          }
        } else {
          // Document doesn't exist, so initialize it with default data
          const initialState = {
            personalInfo: PERSONAL_INFO_VI,
            workExperience: WORK_EXPERIENCE_VI,
            projects: PROJECTS_VI,
            certifications: CERTIFICATIONS_VI,
            skills: SKILLS_DATA_VI,
            themeSettings: INITIAL_THEME_SETTINGS,
          };
          await docRef.set(initialState);
        }
      } catch (e) {
        console.error("Failed to fetch state from Firestore", e);
        setError("Could not load data from the cloud. Displaying default content. Please check Firestore permissions.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [language]);
  
  // Debounced save function to Firestore
  const saveStateToFirestore = useCallback(
    debounce(async (state) => {
      if (!firestore) return;
      
      try {
        // Exclude base64 data from being saved to prevent large document sizes
        const stateToSave = JSON.parse(JSON.stringify(state)); // Deep copy
        if (stateToSave.personalInfo.avatarUrl?.startsWith('data:')) stateToSave.personalInfo.avatarUrl = ''; 
        if (stateToSave.personalInfo.logoUrl?.startsWith('data:')) stateToSave.personalInfo.logoUrl = ''; 
        if (stateToSave.themeSettings.bgImageUrl?.startsWith('data:')) stateToSave.themeSettings.bgImageUrl = ''; 
        if (stateToSave.themeSettings.backgroundMusicUrl?.startsWith('data:')) stateToSave.themeSettings.backgroundMusicUrl = ''; 
        stateToSave.projects = stateToSave.projects.map((p: Project) => p.imageUrl?.startsWith('data:') ? { ...p, imageUrl: 'https://picsum.photos/seed/project/600/400' } : p);
        stateToSave.certifications = stateToSave.certifications.map((c: Certificate) => c.imageUrl?.startsWith('data:') ? { ...c, imageUrl: 'https://picsum.photos/seed/cert/600/400' } : c);

        await firestore.collection('portfolio').doc('data').set(stateToSave);
      } catch (error) {
        console.error("Could not save app state to Firestore.", error);
      }
    }, 2000),
    []
  );

  // Save state to Firestore whenever it changes
  useEffect(() => {
    if (isLoading || !firestore) {
      return;
    }
    const stateToSave = {
      personalInfo,
      workExperience,
      projects,
      certifications,
      skills,
      themeSettings,
    };
    saveStateToFirestore(stateToSave);
  }, [personalInfo, workExperience, projects, certifications, skills, themeSettings, isLoading, saveStateToFirestore]);


  // Check site lock status based on loaded settings.
  useEffect(() => {
    if (themeSettings.isPasswordProtectionEnabled) {
      setIsSiteUnlocked(false);
    } else {
      setIsSiteUnlocked(true);
    }
  }, [themeSettings.isPasswordProtectionEnabled]);

  // Apply theme settings dynamically
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.style.setProperty('--bg-color', themeSettings.bgColor);
    root.style.setProperty('--text-main', themeSettings.textColor);
    root.style.setProperty('--accent-color', themeSettings.accentColor);
    root.style.setProperty('--font-heading', themeSettings.fontHeading);
    root.style.setProperty('--font-body', themeSettings.fontBody);
    root.style.setProperty('--header-bg-color', themeSettings.headerBgColor);
    root.style.setProperty('--header-text-color', themeSettings.headerTextColor);
    root.style.setProperty('--slider-animation-duration', `${themeSettings.sliderSpeed}s`);


    if (themeSettings.bgImageUrl) {
        body.style.backgroundImage = `url('${themeSettings.bgImageUrl}')`;
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundAttachment = 'fixed';
    } else {
        body.style.backgroundImage = 'radial-gradient(circle at 10% 20%, rgba(34, 211, 238, 0.1), transparent 30%), radial-gradient(circle at 80% 90%, rgba(59, 130, 246, 0.1), transparent 30%)';
        body.style.backgroundAttachment = 'scroll'; // Reset
    }

  }, [themeSettings]);

  // Handle background music logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (themeSettings.backgroundMusicUrl) {
      if (audio.src !== themeSettings.backgroundMusicUrl) {
        audio.src = themeSettings.backgroundMusicUrl;
      }
      if (isPlaying) {
        audio.play().catch(e => console.error("Audio play failed:", e));
      } else {
        audio.pause();
      }
    } else {
      audio.pause();
      audio.src = '';
      setIsPlaying(false);
    }
  }, [isPlaying, themeSettings.backgroundMusicUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = themeSettings.backgroundMusicVolume;
    }
  }, [themeSettings.backgroundMusicVolume]);


  const handlePageChange = (page: Page) => {
    setSelectedProject(null); // Clear selected project when changing main pages
    setCurrentPage(page);
  };
  
  const handleUnlockSite = (password: string) => {
    if (password === themeSettings.sitePassword) {
        setIsSiteUnlocked(true);
        return true;
    }
    return false;
  }
  
  const handleAdminLoginForUnlock = (username: string, password: string): boolean => {
    if (username === 'Minh' && password === '2004') {
        setIsSiteUnlocked(true);
        return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPage(Page.Introduction);
  };

  const renderPage = () => {
    if (!isSiteUnlocked) {
        return <Introduction personalInfo={personalInfo} workExperience={workExperience} projects={projects} certifications={certifications} isLimitedView={true}/>;
    }

    if (selectedProject) {
        return <ProjectDetail project={selectedProject} onBack={() => setSelectedProject(null)} />;
    }

    switch (currentPage) {
      case Page.Introduction:
        return <Introduction personalInfo={personalInfo} workExperience={workExperience} projects={projects} certifications={certifications} isLimitedView={false} />;
      case Page.Experience:
        return <Experience workExperience={workExperience} />;
      case Page.Projects:
        return <Projects projects={projects} onProjectSelect={setSelectedProject} />;
      case Page.Certifications:
        return <Certifications certifications={certifications} />;
      case Page.Skills:
        return <Skills skillCategories={skills} />;
      case Page.Settings:
        return isAuthenticated ? (
          <Settings
            personalInfo={personalInfo}
            setPersonalInfo={setPersonalInfo}
            workExperience={workExperience}
            setWorkExperience={setWorkExperience}
            projects={projects}
            setProjects={setProjects}
            certifications={certifications}
            setCertifications={setCertifications}
            skills={skills}
            setSkills={setSkills}
            themeSettings={themeSettings}
            setThemeSettings={setThemeSettings}
          />
        ) : (
          <Login onLoginSuccess={() => setIsAuthenticated(true)} />
        );
      default:
        return <Introduction personalInfo={personalInfo} workExperience={workExperience} projects={projects} certifications={certifications} isLimitedView={false}/>;
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const isLocked = themeSettings.isPasswordProtectionEnabled && !isSiteUnlocked;

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'var(--font-body)' }}>
      <Header 
        currentPage={currentPage} 
        setCurrentPage={handlePageChange} 
        personalInfo={personalInfo} 
        isLocked={isLocked}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 mt-24 transition-all duration-500">
        {renderPage()}
      </main>
      <Footer personalInfo={personalInfo} />
      <audio ref={audioRef} loop />
      <MusicPlayer
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        hasMusic={!!themeSettings.backgroundMusicUrl}
      />
      {isLocked && <SiteLockModal onUnlock={handleUnlockSite} onAdminLogin={handleAdminLoginForUnlock} />}
    </div>
  );
};

const App: React.FC = () => (
  <LanguageProvider>
    <AppContent />
  </LanguageProvider>
);

export default App;
