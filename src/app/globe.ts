import {ChangeDetectionStrategy, Component, ElementRef, viewChild, signal, afterNextRender, OnDestroy} from '@angular/core';
import {DatePipe} from '@angular/common';
import * as d3 from 'd3';
import {GoogleGenAI, Type} from '@google/genai';

interface Feature {
  properties: {
    name: string;
  };
  geometry: unknown;
}

interface TagesschauNewsItem {
  title: string;
  firstSentence: string;
  tags?: {tag: string}[];
  geotags?: {tag: string}[];
}

interface BbcNewsItem {
  title: string;
  summary: string;
  image_link: string;
  news_link: string;
}

interface NytArticle {
  title: string;
  abstract: string;
  section: string;
  geo_facet?: string[];
}

interface GuardianArticle {
  id: string;
  type: string;
  sectionId: string;
  sectionName: string;
  webPublicationDate: string;
  webTitle: string;
  webUrl: string;
  apiUrl: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  selector: 'app-globe',
  template: `
    <div class="relative w-screen h-screen flex flex-col items-center justify-center bg-slate-900 overflow-hidden">
      <!-- Header / Title -->
      <div class="absolute top-6 left-6 z-20 pointer-events-none">
        <h1 class="text-2xl font-black text-white tracking-tighter uppercase italic">Global Conflict Watch</h1>
        <p class="text-[10px] text-slate-500 font-bold tracking-[0.2em] uppercase">Live Geopolitical Intelligence</p>
      </div>

      <!-- Refresh Button -->
      <div class="absolute top-6 right-6 z-20 flex gap-2">
        @if (geminiApiKeyMissing()) {
          <button (click)="openKeySelector()" 
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 border border-blue-400 rounded-full text-[10px] font-bold text-white uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-blue-500/20">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
            Set Gemini API Key
          </button>
        }
        <button (click)="refreshGlobalAnalysis()" 
          class="flex items-center gap-2 px-4 py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-full text-[10px] font-bold text-white uppercase tracking-wider transition-all cursor-pointer group"
          [disabled]="loading()">
          @if (loading()) {
            <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
            Analyzing...
          } @else {
            <svg class="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            Refresh Global Analysis
          }
        </button>
      </div>

      @if (loading()) {
        <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 text-white">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p class="text-lg font-medium">Analyzing global news for conflict data...</p>
        </div>
      }
      <div #globeContainer class="w-full h-full cursor-grab active:cursor-grabbing"></div>
      
      <!-- Legend -->
      <div class="absolute bottom-6 left-6 bg-slate-800/90 p-4 rounded-lg border border-slate-700 text-sm text-slate-200 shadow-lg backdrop-blur-sm">
        <h3 class="font-semibold mb-2 text-white">Global Status</h3>
        <div class="flex items-center gap-2 mb-1">
          <div class="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Active Conflict / War</span>
        </div>
        <div class="flex items-center gap-2 mb-1">
          <div class="w-3 h-3 rounded-full bg-orange-500"></div>
          <span>Tense Situation</span>
        </div>
        <div class="flex items-center gap-2 mb-1">
          <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
          <span>Watch Out / Caution</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-slate-600"></div>
          <span>Stable / No Data</span>
        </div>
      </div>

      <!-- Tooltip -->
      @if (hoveredCountry()) {
        <div class="absolute top-6 right-6 bg-slate-800/90 p-4 rounded-lg border border-slate-700 text-slate-200 shadow-lg backdrop-blur-sm max-w-xs pointer-events-none z-10">
          <h3 class="font-bold text-lg text-white mb-1">{{ hoveredCountry()?.name }}</h3>
          <div class="flex items-center gap-2">
            <span class="uppercase text-xs font-bold tracking-wider" [class]="getStatusColorText(hoveredCountry()?.status)">
              {{ hoveredCountry()?.status || 'Stable' }}
            </span>
          </div>
        </div>
      }

      <!-- Side Panel for Country Details -->
      @if (selectedCountry()) {
        <div class="absolute top-0 right-0 w-80 sm:w-96 h-full bg-slate-800/95 border-l border-slate-700 shadow-2xl backdrop-blur-md flex flex-col z-20">
          <div class="p-4 border-b border-slate-700 flex justify-between items-center">
            <h2 class="text-xl font-bold text-white">{{ selectedCountry()?.name }}</h2>
            <button (click)="closeDetails()" class="text-slate-400 hover:text-white transition-colors cursor-pointer">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="p-5 flex-1 overflow-y-auto text-slate-300">
            <div class="mb-6 flex items-center gap-2">
              <span class="text-sm text-slate-400">Status:</span>
              <span class="uppercase text-xs font-bold tracking-wider px-2 py-1 rounded bg-slate-900" [class]="getStatusColorText(selectedCountry()?.status)">
                {{ selectedCountry()?.status || 'Stable' }}
              </span>
            </div>

            <!-- Navigation Menu or Back Button -->
            @if (activeTab() !== 'menu') {
              <button (click)="activeTab.set('menu')" class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 mb-4 transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                Back to Sources
              </button>
            }

            @if (countryDetailsLoading()) {
              <div class="flex flex-col items-center justify-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mb-4"></div>
                <p class="text-sm text-slate-400 animate-pulse">Gathering latest news...</p>
              </div>
            } @else {
              @if (activeTab() === 'menu') {
                <div class="space-y-2">
                  <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Available Sources</p>
                  
                  <button (click)="activeTab.set('analysis')" class="w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/50 rounded-xl transition-all group cursor-pointer">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.364-6.364l-.707-.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M12 13a3 3 0 100-6 3 3 0 000 6z"></path></svg>
                      </div>
                      <div class="text-left">
                        <span class="block text-sm font-bold text-white">AI Geopolitical Analysis</span>
                        <span class="text-[10px] text-slate-500">Summary of the current situation</span>
                      </div>
                    </div>
                    <svg class="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>

                  <button (click)="activeTab.set('tagesschau')" class="w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/50 rounded-xl transition-all group cursor-pointer">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-slate-800 rounded-lg text-slate-300 group-hover:scale-110 transition-transform">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 4v4h4"></path></svg>
                      </div>
                      <div class="text-left">
                        <span class="block text-sm font-bold text-white">Tagesschau</span>
                        <span class="text-[10px] text-slate-500">{{ filteredTagesschau().length }} articles found</span>
                      </div>
                    </div>
                    <svg class="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>

                  <button (click)="activeTab.set('bbc')" class="w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/50 rounded-xl transition-all group cursor-pointer">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-red-500/10 rounded-lg text-red-400 group-hover:scale-110 transition-transform">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </div>
                      <div class="text-left">
                        <span class="block text-sm font-bold text-white">BBC News</span>
                        <span class="text-[10px] text-slate-500">{{ filteredBbc().length }} articles found</span>
                      </div>
                    </div>
                    <svg class="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>

                  <button (click)="activeTab.set('nyt')" class="w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/50 rounded-xl transition-all group cursor-pointer">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-slate-800 rounded-lg text-white group-hover:scale-110 transition-transform">
                        <span class="font-serif font-bold text-lg leading-none">T</span>
                      </div>
                      <div class="text-left">
                        <span class="block text-sm font-bold text-white">The New York Times</span>
                        <span class="text-[10px] text-slate-500">{{ filteredNyt().length }} articles found</span>
                      </div>
                    </div>
                    <svg class="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>

                  <button (click)="activeTab.set('guardian')" class="w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/50 rounded-xl transition-all group cursor-pointer">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-blue-600/10 rounded-lg text-blue-500 group-hover:scale-110 transition-transform">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                      </div>
                      <div class="text-left">
                        <span class="block text-sm font-bold text-white">The Guardian</span>
                        <span class="text-[10px] text-slate-500">{{ filteredGuardian().length }} articles found</span>
                      </div>
                    </div>
                    <svg class="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>
                </div>
              } @else if (activeTab() === 'analysis') {
                <div class="text-sm whitespace-pre-wrap leading-relaxed">
                  {{ countryDetails() || 'No analysis available.' }}
                </div>
              } @else if (activeTab() === 'tagesschau') {
                <div class="space-y-4">
                  @for (item of filteredTagesschau(); track item.title) {
                    <div class="p-3 bg-slate-900/50 rounded border border-slate-700">
                      <h4 class="font-bold text-white mb-1">{{ item.title }}</h4>
                      <p class="text-xs text-slate-400">{{ item.firstSentence }}</p>
                    </div>
                  } @empty {
                    <p class="text-sm text-slate-500 italic">No Tagesschau news found for this country.</p>
                  }
                </div>
              } @else if (activeTab() === 'bbc') {
                <div class="space-y-4">
                  @for (item of filteredBbc(); track item.title) {
                    <div class="p-3 bg-slate-900/50 rounded border border-slate-700">
                      <h4 class="font-bold text-white mb-1">{{ item.title }}</h4>
                      <p class="text-xs text-slate-400 mb-2">{{ item.summary }}</p>
                      <a [href]="item.news_link" target="_blank" class="text-[10px] text-blue-400 hover:underline">Read on BBC</a>
                    </div>
                  } @empty {
                    <p class="text-sm text-slate-500 italic">No BBC news found for this country.</p>
                  }
                </div>
              } @else if (activeTab() === 'nyt') {
                <div class="space-y-4">
                  @if (nytApiKeyMissing()) {
                    <div class="p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg text-sm text-orange-200">
                      <p class="font-bold mb-1">NYT API Key Missing</p>
                      <p class="text-xs opacity-80">To see news from the New York Times, please add your API key to the environment variables as <code class="bg-black/40 px-1 rounded">NYT_API_KEY</code>.</p>
                    </div>
                  }
                  @for (item of filteredNyt(); track item.title) {
                    <div class="p-3 bg-slate-900/50 rounded border border-slate-700">
                      <h4 class="font-bold text-white mb-1">{{ item.title }}</h4>
                      <p class="text-xs text-slate-400">{{ item.abstract }}</p>
                    </div>
                  } @empty {
                    <p class="text-sm text-slate-500 italic">No NYT news found for this country.</p>
                  }
                </div>
              } @else if (activeTab() === 'guardian') {
                <div class="space-y-4">
                  @if (guardianApiKeyMissing()) {
                    <div class="p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg text-sm text-orange-200">
                      <p class="font-bold mb-1">Guardian API Key Missing</p>
                      <p class="text-xs opacity-80">To see news from The Guardian, please add your API key to the environment variables as <code class="bg-black/40 px-1 rounded">GUARDIAN_API_KEY</code>.</p>
                    </div>
                  }
                  @for (item of filteredGuardian(); track item.webTitle) {
                    <div class="p-3 bg-slate-900/50 rounded border border-slate-700">
                      <h4 class="font-bold text-white mb-1">{{ item.webTitle }}</h4>
                      <p class="text-xs text-slate-400 mb-2">{{ item.sectionName }} - {{ item.webPublicationDate | date:'short' }}</p>
                      <a [href]="item.webUrl" target="_blank" class="text-[10px] text-blue-400 hover:underline">Read on The Guardian</a>
                    </div>
                  } @empty {
                    <p class="text-sm text-slate-500 italic">No Guardian news found for this country.</p>
                  }
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class Globe implements OnDestroy {
  private globeContainer = viewChild.required<ElementRef>('globeContainer');
  private resizeObserver?: ResizeObserver;
  private worldData: {features: Feature[]} | null = null;
  private countryStatuses: Record<string, string> = {};
  
  loading = signal(true);
  hoveredCountry = signal<{name: string, status: string} | null>(null);
  selectedCountry = signal<{name: string, status: string} | null>(null);
  countryDetailsLoading = signal(false);
  countryDetails = signal<string | null>(null);
  activeTab = signal<'menu' | 'analysis' | 'tagesschau' | 'bbc' | 'nyt' | 'guardian'>('menu');
  nytApiKeyMissing = signal(false);
  guardianApiKeyMissing = signal(false);
  geminiApiKeyMissing = signal(false);
  
  filteredTagesschau = signal<TagesschauNewsItem[]>([]);
  filteredBbc = signal<BbcNewsItem[]>([]);
  filteredNyt = signal<NytArticle[]>([]);
  filteredGuardian = signal<GuardianArticle[]>([]);
  
  private tagesschauNews: TagesschauNewsItem[] = [];
  private bbcNews: BbcNewsItem[] = [];
  private nytNews: NytArticle[] = [];
  private guardianNews: GuardianArticle[] = [];

  constructor() {
    afterNextRender(() => {
      this.initGlobe();
    });
  }

  async openKeySelector() {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      this.geminiApiKeyMissing.set(false);
      this.refreshGlobalAnalysis();
    }
  }

  private async getAI(): Promise<GoogleGenAI | null> {
    let key = '';
    try {
      if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
        key = GEMINI_API_KEY;
      }
    } catch {
      // Ignore ReferenceError if variable is not defined
    }

    if (key) {
      this.geminiApiKeyMissing.set(false);
      return new GoogleGenAI({apiKey: key});
    }

    // Check if user has selected a key via the dialog
    if (window.aistudio?.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (hasKey) {
        this.geminiApiKeyMissing.set(false);
        // The platform intercepts requests and injects the key.
        // We pass a dummy key to satisfy the SDK's validation.
        return new GoogleGenAI({apiKey: 'platform_injected_key'});
      }
    }

    this.geminiApiKeyMissing.set(true);
    return null;
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  async refreshGlobalAnalysis() {
    this.loading.set(true);
    try {
      this.countryStatuses = await this.getCountryStatuses();
      this.renderGlobe();
    } catch (error) {
      console.error('Error refreshing global analysis:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async initGlobe() {
    // Initial data fetch
    try {
      this.worldData = await d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson') as {features: Feature[]};
      this.countryStatuses = await this.getCountryStatuses();
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }

    // Initial render
    this.renderGlobe();

    // Setup resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.renderGlobe();
    });
    this.resizeObserver.observe(this.globeContainer().nativeElement);
  }

  getStatusColorText(status?: string): string {
    if (status === 'war') return 'text-red-400';
    if (status === 'tense') return 'text-orange-400';
    if (status === 'watch') return 'text-yellow-400';
    return 'text-slate-400';
  }

  closeDetails() {
    this.selectedCountry.set(null);
    this.countryDetails.set(null);
  }

  async fetchCountryDetails(name: string, status: string) {
    this.selectedCountry.set({ name, status });
    this.countryDetailsLoading.set(true);
    this.countryDetails.set(null);
    this.activeTab.set('menu');
    
    const ai = await this.getAI();
    if (!ai) {
      this.countryDetails.set('Error: Gemini API key is missing. Please set your API key using the button in the top-right corner.');
      this.countryDetailsLoading.set(false);
      return;
    }

    try {
      const searchTerms = [name.toLowerCase()];
      // Add common variations
      if (name === 'United States') searchTerms.push('us', 'usa', 'america');
      if (name === 'United Kingdom') searchTerms.push('uk', 'britain', 'england');
      if (name === 'Russian Federation') searchTerms.push('russia');
      if (name === 'Iran, Islamic Republic of') searchTerms.push('iran');
      if (name === 'Syrian Arab Republic') searchTerms.push('syria');

      const matches = (text: string) => {
        const lowerText = text.toLowerCase();
        return searchTerms.some(term => lowerText.includes(term));
      };

      // Find relevant news from Tagesschau
      const relevantTagesschau = this.tagesschauNews.filter(item => {
        const text = `${item.title} ${item.firstSentence} ${item.tags?.map((t) => t.tag).join(' ')} ${item.geotags?.map((t) => t.tag).join(' ')}`;
        return matches(text);
      });
      this.filteredTagesschau.set(relevantTagesschau);

      // Find relevant news from BBC
      const relevantBbc = this.bbcNews.filter(item => {
        const text = `${item.title} ${item.summary}`;
        return matches(text);
      });
      this.filteredBbc.set(relevantBbc);

      // Find relevant news from NYT
      const relevantNyt = this.nytNews.filter(item => {
        const text = `${item.title} ${item.abstract} ${item.geo_facet?.join(' ')}`;
        return matches(text);
      });
      this.filteredNyt.set(relevantNyt);

      // Find relevant news from Guardian
      const relevantGuardian = this.guardianNews.filter(item => {
        const text = `${item.webTitle} ${item.sectionName}`;
        return matches(text);
      });
      this.filteredGuardian.set(relevantGuardian);

      let newsContext = '';
      if (relevantTagesschau.length > 0) {
        newsContext += `Tagesschau:\n` + relevantTagesschau.map(item => `Title: ${item.title}\nSummary: ${item.firstSentence}`).join('\n\n') + '\n\n';
      }
      if (relevantBbc.length > 0) {
        newsContext += `BBC News:\n` + relevantBbc.map(item => `Title: ${item.title}\nSummary: ${item.summary}`).join('\n\n') + '\n\n';
      }
      if (relevantNyt.length > 0) {
        newsContext += `NYT News:\n` + relevantNyt.map(item => `Title: ${item.title}\nSummary: ${item.abstract}`).join('\n\n') + '\n\n';
      }
      if (relevantGuardian.length > 0) {
        newsContext += `The Guardian News:\n` + relevantGuardian.map(item => `Title: ${item.webTitle}\nSection: ${item.sectionName}`).join('\n\n') + '\n\n';
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Based on the following recent news from Tagesschau, BBC, NYT, and The Guardian (if any) and your general knowledge, provide a brief, 2-3 paragraph summary of the current geopolitical situation in ${name}. It is currently marked as "${status}". Focus on conflicts, tensions, or political instability. Do not use markdown formatting like bolding or headers, just plain text paragraphs.\n\nRecent News for ${name}:\n${newsContext || 'No specific recent news found in the latest feeds.'}`,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });
      this.countryDetails.set(response.text || 'No details found.');
    } catch (error) {
      console.error('Error fetching details:', error);
      this.countryDetails.set('Failed to load details. Please try again later.');
    } finally {
      this.countryDetailsLoading.set(false);
    }
  }

  private async renderGlobe() {
    const container = this.globeContainer().nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    if (width === 0 || height === 0) return;

    // Clear any existing SVG
    d3.select(container).selectAll('*').remove();

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    const initialScale = Math.min(width, height) / 2.2;
    const projection = d3.geoOrthographic()
      .scale(initialScale)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .precision(0.1);

    const path = d3.geoPath().projection(projection);

    // Add ocean/sphere
    svg.append('path')
      .datum({type: 'Sphere'})
      .attr('class', 'sphere')
      .attr('d', (d: unknown) => path(d as d3.GeoPermissibleObjects) || '')
      .attr('fill', '#0f172a') // slate-900
      .attr('stroke', '#334155') // slate-700
      .attr('stroke-width', 1);

    // Add graticule (grid lines)
    const graticule = d3.geoGraticule();
    svg.append('path')
      .datum(graticule)
      .attr('class', 'graticule')
      .attr('d', (d: unknown) => path(d as d3.GeoPermissibleObjects) || '')
      .attr('fill', 'none')
      .attr('stroke', '#1e293b') // slate-800
      .attr('stroke-width', 0.5);

    // Create a group for countries
    const g = svg.append('g');

    if (this.worldData) {
      this.loading.set(false);

      // Draw countries
      g.selectAll('path')
        .data(this.worldData.features)
        .enter()
        .append('path')
        .attr('d', (d: Feature) => path(d as unknown as d3.GeoPermissibleObjects) || '')
        .attr('fill', (d: Feature) => {
          const status = this.countryStatuses[d.properties.name];
          if (status === 'war') return '#ef4444'; // red-500
          if (status === 'tense') return '#f97316'; // orange-500
          if (status === 'watch') return '#facc15'; // yellow-400
          return '#475569'; // slate-600
        })
        .attr('stroke', '#0f172a') // slate-900
        .attr('stroke-width', 0.5)
        .attr('class', 'transition-colors duration-200')
        .on('mouseover', (event: MouseEvent, d: Feature) => {
          const status = this.countryStatuses[d.properties.name];
          this.hoveredCountry.set({
            name: d.properties.name,
            status: status || 'stable'
          });
          d3.select(event.currentTarget as Element)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.5)
            .raise();
        })
        .on('mouseout', (event: MouseEvent) => {
          this.hoveredCountry.set(null);
          d3.select(event.currentTarget as Element)
            .attr('stroke', '#0f172a')
            .attr('stroke-width', 0.5);
        })
        .on('click', (event: MouseEvent, d: Feature) => {
          const status = this.countryStatuses[d.properties.name] || 'stable';
          this.fetchCountryDetails(d.properties.name, status);
        });
    }

    // Add drag behavior for rotation
    const drag = d3.drag<SVGSVGElement, unknown>()
      .on('drag', (event) => {
        const rotate = projection.rotate();
        // Adjust rotation based on drag distance
        const k = 75 / projection.scale();
        projection.rotate([
          rotate[0] + event.dx * k,
          rotate[1] - event.dy * k
        ]);
        
        // Update all paths
        svg.selectAll('path').attr('d', (d: unknown) => path(d as d3.GeoPermissibleObjects) || '');
      });

    svg.call(drag);

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([initialScale * 0.5, initialScale * 4])
      .on('zoom', (event) => {
        projection.scale(event.transform.k);
        svg.selectAll('path').attr('d', (d: unknown) => path(d as d3.GeoPermissibleObjects) || '');
      });

    svg.call(zoom)
      .on("mousedown.zoom", null)
      .on("touchstart.zoom", null)
      .on("touchmove.zoom", null)
      .on("touchend.zoom", null);
      
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(initialScale));
  }

  private async getCountryStatuses(): Promise<Record<string, string>> {
    const ai = await this.getAI();
    if (!ai) {
      console.warn('AI initialization failed. Skipping global analysis.');
      return {};
    }
    try {
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      
      // Fetch news from Tagesschau API
      const tagesschauPromise = fetch(`${proxyUrl}${encodeURIComponent('https://www.tagesschau.de/api2u/news/?regions=9&ressort=ausland')}`)
        .then(res => res.json())
        .catch(() => ({ news: [] }));

      // Fetch news from BBC via RSS-to-JSON (more reliable)
      const bbcNewsPromise = fetch(`${proxyUrl}${encodeURIComponent('https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/world/rss.xml')}`)
        .then(res => res.json())
        .catch(() => ({ items: [] }));

      // Fetch news from NYT API
      let nytPromise: Promise<{results: NytArticle[]}> = Promise.resolve({ results: [] });
      if (typeof NYT_API_KEY !== 'undefined' && NYT_API_KEY) {
        this.nytApiKeyMissing.set(false);
        nytPromise = fetch(`https://api.nytimes.com/svc/news/v3/content/all/all.json?api-key=${NYT_API_KEY}&limit=60`, {
          headers: { 'accept': 'application/json' }
        }).then(res => res.json())
          .catch(() => fetch(`${proxyUrl}${encodeURIComponent(`https://api.nytimes.com/svc/news/v3/content/all/all.json?api-key=${NYT_API_KEY}&limit=60`)}`).then(res => res.json()))
          .catch(() => ({ results: [] }));
      } else {
        this.nytApiKeyMissing.set(true);
        console.warn('NYT_API_KEY is not defined. Skipping NYT news fetch.');
      }

      // Fetch news from Guardian API
      let guardianPromise: Promise<{response: {results: GuardianArticle[]}}> = Promise.resolve({ response: { results: [] } });
      if (typeof GUARDIAN_API_KEY !== 'undefined' && GUARDIAN_API_KEY) {
        this.guardianApiKeyMissing.set(false);
        guardianPromise = fetch(`https://content.guardianapis.com/search?api-key=${GUARDIAN_API_KEY}&page-size=50&section=world|politics`, {
          headers: { 'accept': 'application/json' }
        }).then(res => res.json())
          .catch(() => fetch(`${proxyUrl}${encodeURIComponent(`https://content.guardianapis.com/search?api-key=${GUARDIAN_API_KEY}&page-size=50&section=world|politics`)}`).then(res => res.json()))
          .catch(() => ({ response: { results: [] } }));
      } else {
        this.guardianApiKeyMissing.set(true);
        console.warn('GUARDIAN_API_KEY is not defined. Skipping Guardian news fetch.');
      }

      const [newsData, bbcData, nytData, guardianData] = await Promise.all([
        tagesschauPromise, 
        bbcNewsPromise, 
        nytPromise,
        guardianPromise
      ]);
      
      this.tagesschauNews = newsData.news || [];
      
      // Extract BBC news from RSS items
      const bbcArticles: BbcNewsItem[] = [];
      if (bbcData && Array.isArray(bbcData.items)) {
        interface RssItem {
          title: string;
          description?: string;
          content?: string;
          thumbnail?: string;
          link: string;
        }
        bbcData.items.forEach((item: RssItem) => {
          bbcArticles.push({
            title: item.title,
            summary: item.description || item.content || '',
            image_link: item.thumbnail || '',
            news_link: item.link
          });
        });
      }
      this.bbcNews = bbcArticles;
      this.nytNews = nytData.results || [];
      this.guardianNews = guardianData.response?.results || [];
      
      // Extract relevant text from news
      const tagesschauText = this.tagesschauNews.slice(0, 20).map((item) => 
        `Title: ${item.title}\nSummary: ${item.firstSentence}\nTags: ${item.tags?.map((t) => t.tag).join(', ')}\nGeotags: ${item.geotags?.map((t) => t.tag).join(', ')}`
      ).join('\n\n');

      const bbcText = this.bbcNews.slice(0, 20).map((item) => 
        `Title: ${item.title}\nSummary: ${item.summary}`
      ).join('\n\n');

      const nytText = this.nytNews.slice(0, 20).map((item) => 
        `Title: ${item.title}\nSummary: ${item.abstract}\nGeo: ${item.geo_facet?.join(', ')}`
      ).join('\n\n');

      const guardianText = this.guardianNews.slice(0, 20).map((item) => 
        `Title: ${item.webTitle}\nSection: ${item.sectionName}`
      ).join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Based on the provided news snippets AND your own real-time search capabilities, identify ALL countries currently experiencing major geopolitical issues. 
        
        Categorize them into:
        1. "war": Active major armed conflicts, invasions, or full-scale civil wars.
        2. "tense": High military tension, border skirmishes, significant internal unrest, recent coups, or severe political instability.
        3. "watch": Emerging crises, potential for instability, significant protests, or diplomatic breakdowns.
        
        Be thorough and inclusive of all regions including Sub-Saharan Africa, Latin America, Southeast Asia, and Central Asia. Many regional conflicts may not be in the top headlines but are critical.
        
        Return ONLY a JSON object with these three arrays of country names. Use standard English country names.
        
        Tagesschau News:\n${tagesschauText}\n\nBBC News:\n${bbcText}\n\nNYT News:\n${nytText}\n\nThe Guardian News:\n${guardianText}`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              war: {type: Type.ARRAY, items: {type: Type.STRING}, description: "Countries with active major conflicts"},
              tense: {type: Type.ARRAY, items: {type: Type.STRING}, description: "Countries with high tension or significant unrest"},
              watch: {type: Type.ARRAY, items: {type: Type.STRING}, description: "Countries to watch for potential instability"},
            },
          },
        },
      });
      
      const data = JSON.parse(response.text || '{}');
      const result: Record<string, string> = {};
      
      // Map standard names to geojson names if needed, or just use lowercase matching
      const normalize = (name: string) => name.toLowerCase().trim();
      
      if (data.war) data.war.forEach((c: string) => result[c] = 'war');
      if (data.tense) data.tense.forEach((c: string) => result[c] = 'tense');
      if (data.watch) data.watch.forEach((c: string) => result[c] = 'watch');
      
      // Also create a normalized version for better matching
      const normalizedResult: Record<string, string> = {};
      Object.entries(result).forEach(([key, value]) => {
        normalizedResult[normalize(key)] = value;
      });
      
      // Return a proxy that tries exact match first, then normalized match
      return new Proxy(result, {
        get: (target, prop: string) => {
          if (prop in target) return target[prop];
          return normalizedResult[normalize(prop)];
        }
      });
    } catch (error) {
      console.error('Error fetching statuses:', error);
      return {};
    }
  }
}
