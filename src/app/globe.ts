import {ChangeDetectionStrategy, Component, ElementRef, viewChild, signal, afterNextRender, OnDestroy} from '@angular/core';
import {DatePipe} from '@angular/common';
import * as d3 from 'd3';
import {GoogleGenAI, Type, ThinkingLevel} from '@google/genai';

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

interface AllAfricaNewsItem {
  title: string;
  summary: string;
  news_link: string;
}

interface MercoPressNewsItem {
  title: string;
  summary: string;
  news_link: string;
}

interface SourceStatus {
  source: string;
  status: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  selector: 'app-globe',
  template: `
    <div class="relative w-screen h-screen flex flex-col items-center justify-center bg-slate-900 overflow-hidden">
      @if (loading()) {
        <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 text-white">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p class="text-lg font-medium">Analyzing global news for conflict data...</p>
          <p class="text-sm text-slate-400 mt-2">made by eimithut</p>
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
        <div class="flex items-center gap-2 mb-1">
          <div class="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Stable</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-sm bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
            <svg class="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="2" y1="2" x2="22" y2="22"></line>
              <path d="M8.5 16.5a5 5 0 0 1 7 0"></path>
              <path d="M5 13a10 10 0 0 1 14 0"></path>
              <path d="M2 8.8a15 15 0 0 1 20 0"></path>
              <line x1="12" y1="20" x2="12.01" y2="20"></line>
            </svg>
          </div>
          <span>No Data</span>
        </div>
      </div>

      <!-- Tooltip -->
      @if (hoveredCountry()) {
        <div class="absolute top-6 right-6 bg-slate-800/90 p-4 rounded-lg border border-slate-700 text-slate-200 shadow-lg backdrop-blur-sm max-w-xs pointer-events-none z-10">
          <h3 class="font-bold text-lg text-white mb-1">{{ hoveredCountry()?.name }}</h3>
          <div class="flex flex-col gap-1">
            @if (hoveredCountry()?.statuses?.length) {
              @for (s of hoveredCountry()?.statuses; track s.source) {
                <div class="flex items-center justify-between gap-4">
                  <span class="text-xs text-slate-400">{{ s.source }}</span>
                  <span class="uppercase text-xs font-bold tracking-wider" [class]="getStatusColorText(s.status)">
                    {{ s.status }}
                  </span>
                </div>
              }
            } @else {
              <span class="uppercase text-xs font-bold tracking-wider text-slate-500">
                No Data
              </span>
            }
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
            <div class="mb-6 flex flex-col gap-2">
              <span class="text-sm text-slate-400">Status:</span>
              @if (selectedCountry()?.statuses?.length) {
                <div class="flex flex-wrap gap-2">
                  @for (s of selectedCountry()?.statuses; track s.source) {
                    <div class="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                      <span class="text-xs text-slate-400">{{ s.source }}:</span>
                      <span class="uppercase text-xs font-bold tracking-wider" [class]="getStatusColorText(s.status)">
                        {{ s.status }}
                      </span>
                    </div>
                  }
                </div>
              } @else {
                <span class="uppercase text-xs font-bold tracking-wider px-2 py-1 rounded bg-slate-900 text-slate-500 inline-block w-fit">
                  No Data
                </span>
              }
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
                  
                  <button (click)="openAnalysis()" class="w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/50 rounded-xl transition-all group cursor-pointer">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.364-6.364l-.707-.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M12 13a3 3 0 100-6 3 3 0 000 6z"></path></svg>
                      </div>
                      <div class="text-left">
                        <span class="block text-sm font-bold text-white">AI Geopolitical Analysis</span>
                        <span class="text-[10px] text-slate-500">Generate summary on-demand</span>
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
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477-4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                      </div>
                      <div class="text-left">
                        <span class="block text-sm font-bold text-white">The Guardian</span>
                        <span class="text-[10px] text-slate-500">{{ filteredGuardian().length }} articles found</span>
                      </div>
                    </div>
                    <svg class="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>

                  <button (click)="activeTab.set('allafrica')" class="w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/50 rounded-xl transition-all group cursor-pointer">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-green-500/10 rounded-lg text-green-400 group-hover:scale-110 transition-transform">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </div>
                      <div class="text-left">
                        <span class="block text-sm font-bold text-white">AllAfrica</span>
                        <span class="text-[10px] text-slate-500">{{ filteredAllAfrica().length }} articles found</span>
                      </div>
                    </div>
                    <svg class="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>

                  <button (click)="activeTab.set('mercopress')" class="w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/50 rounded-xl transition-all group cursor-pointer">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-yellow-500/10 rounded-lg text-yellow-400 group-hover:scale-110 transition-transform">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </div>
                      <div class="text-left">
                        <span class="block text-sm font-bold text-white">MercoPress</span>
                        <span class="text-[10px] text-slate-500">{{ filteredMercoPress().length }} articles found</span>
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
              } @else if (activeTab() === 'allafrica') {
                <div class="space-y-4">
                  @for (item of filteredAllAfrica(); track item.title) {
                    <div class="p-3 bg-slate-900/50 rounded border border-slate-700">
                      <h4 class="font-bold text-white mb-1">{{ item.title }}</h4>
                      <p class="text-xs text-slate-400 mb-2">{{ item.summary }}</p>
                      <a [href]="item.news_link" target="_blank" class="text-[10px] text-blue-400 hover:underline">Read on AllAfrica</a>
                    </div>
                  } @empty {
                    <p class="text-sm text-slate-500 italic">No AllAfrica news found for this country.</p>
                  }
                </div>
              } @else if (activeTab() === 'mercopress') {
                <div class="space-y-4">
                  @for (item of filteredMercoPress(); track item.title) {
                    <div class="p-3 bg-slate-900/50 rounded border border-slate-700">
                      <h4 class="font-bold text-white mb-1">{{ item.title }}</h4>
                      <p class="text-xs text-slate-400 mb-2">{{ item.summary }}</p>
                      <a [href]="item.news_link" target="_blank" class="text-[10px] text-blue-400 hover:underline">Read on MercoPress</a>
                    </div>
                  } @empty {
                    <p class="text-sm text-slate-500 italic">No MercoPress news found for this country.</p>
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
  private ai!: GoogleGenAI;
  private resizeObserver?: ResizeObserver;
  private worldData: {features: Feature[]} | null = null;
  private countryStatuses: Record<string, SourceStatus[]> = {};
  
  loading = signal(true);
  hoveredCountry = signal<{name: string, statuses: SourceStatus[]} | null>(null);
  selectedCountry = signal<{name: string, statuses: SourceStatus[]} | null>(null);
  countryDetailsLoading = signal(false);
  countryDetails = signal<string | null>(null);
  activeTab = signal<'menu' | 'analysis' | 'tagesschau' | 'bbc' | 'nyt' | 'guardian' | 'allafrica' | 'mercopress'>('menu');
  nytApiKeyMissing = signal(false);
  guardianApiKeyMissing = signal(false);
  
  filteredTagesschau = signal<TagesschauNewsItem[]>([]);
  filteredBbc = signal<BbcNewsItem[]>([]);
  filteredNyt = signal<NytArticle[]>([]);
  filteredGuardian = signal<GuardianArticle[]>([]);
  filteredAllAfrica = signal<AllAfricaNewsItem[]>([]);
  filteredMercoPress = signal<MercoPressNewsItem[]>([]);
  
  private tagesschauNews: TagesschauNewsItem[] = [];
  private bbcNews: BbcNewsItem[] = [];
  private nytNews: NytArticle[] = [];
  private guardianNews: GuardianArticle[] = [];
  private allAfricaNews: AllAfricaNewsItem[] = [];
  private mercoPressNews: MercoPressNewsItem[] = [];

  constructor() {
    if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});
    } else {
      console.error('GEMINI_API_KEY is not defined.');
    }
    afterNextRender(() => {
      this.initGlobe();
    });
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
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
    if (status === 'stable') return 'text-green-400';
    return 'text-slate-400';
  }

  getColorHexForStatus(status: string): string {
    if (status === 'war') return '#ef4444'; // red-500
    if (status === 'tense') return '#f97316'; // orange-500
    if (status === 'watch') return '#facc15'; // yellow-400
    if (status === 'stable') return '#22c55e'; // green-500
    return '#475569'; // slate-600
  }

  closeDetails() {
    this.selectedCountry.set(null);
    this.countryDetails.set(null);
  }

  async fetchCountryDetails(name: string, statuses: SourceStatus[]) {
    this.selectedCountry.set({ name, statuses });
    this.countryDetails.set(null);
    this.activeTab.set('menu');
    
    // Filter news immediately without AI
    const searchTerms = [name.toLowerCase()];
    if (name === 'United States') searchTerms.push('us', 'usa', 'america');
    if (name === 'United Kingdom') searchTerms.push('uk', 'britain', 'england');
    if (name === 'Russian Federation') searchTerms.push('russia');
    if (name === 'Iran, Islamic Republic of') searchTerms.push('iran');
    if (name === 'Syrian Arab Republic') searchTerms.push('syria');

    const matches = (text: string | null | undefined) => {
      if (!text) return false;
      const lowerText = text.toLowerCase();
      return searchTerms.some(term => lowerText.includes(term));
    };

    this.filteredTagesschau.set(this.tagesschauNews.filter(item => matches(item.title) || matches(item.firstSentence)));
    this.filteredBbc.set(this.bbcNews.filter(item => matches(item.title) || matches(item.summary)));
    this.filteredNyt.set(this.nytNews.filter(item => matches(item.title) || matches(item.abstract)));
    this.filteredGuardian.set(this.guardianNews.filter(item => matches(item.webTitle)));
    this.filteredAllAfrica.set(this.allAfricaNews.filter(item => matches(item.title) || matches(item.summary)));
    this.filteredMercoPress.set(this.mercoPressNews.filter(item => matches(item.title) || matches(item.summary)));
  }

  async openAnalysis() {
    const country = this.selectedCountry();
    if (!country) return;

    this.activeTab.set('analysis');
    if (this.countryDetails()) return; // Already loaded

    this.countryDetailsLoading.set(true);
    
    if (!this.ai) {
      this.countryDetails.set('Error: Gemini API key is missing.');
      this.countryDetailsLoading.set(false);
      return;
    }

    try {
      const name = country.name;
      const statuses = country.statuses;

      let newsContext = '';
      const sources = [
        { name: 'Tagesschau', news: this.filteredTagesschau() },
        { name: 'BBC', news: this.filteredBbc() },
        { name: 'NYT', news: this.filteredNyt() },
        { name: 'The Guardian', news: this.filteredGuardian() },
        { name: 'AllAfrica', news: this.filteredAllAfrica() },
        { name: 'MercoPress', news: this.filteredMercoPress() }
      ];

      sources.forEach(s => {
        if (s.news.length > 0) {
          newsContext += `${s.name}:\n` + s.news.slice(0, 5).map((item: TagesschauNewsItem | BbcNewsItem | NytArticle | GuardianArticle | AllAfricaNewsItem | MercoPressNewsItem) => {
            let title = '';
            let summary = '';
            
            if ('title' in item) title = item.title;
            else if ('webTitle' in item) title = item.webTitle;
            
            if ('summary' in item) summary = item.summary;
            else if ('abstract' in item) summary = item.abstract;
            else if ('firstSentence' in item) summary = item.firstSentence;
            else if ('sectionName' in item) summary = item.sectionName;

            return `Title: ${title}\nSummary: ${summary}`;
          }).join('\n\n') + '\n\n';
        }
      });

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Based on the following recent news and your general knowledge, provide a brief, 2-3 paragraph summary of the current geopolitical situation in ${name}. It is currently marked with the following statuses by different sources: ${statuses.map(s => `${s.source}: ${s.status}`).join(', ') || 'No Data'}. Focus on conflicts, tensions, or political instability. Do not use markdown formatting like bolding or headers, just plain text paragraphs.\n\nRecent News for ${name}:\n${newsContext || 'No specific recent news found in the latest feeds.'}`,
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

    const defs = svg.append('defs');
    
    const pattern = defs.append('pattern')
      .attr('id', 'no-data-pattern')
      .attr('width', 24)
      .attr('height', 24)
      .attr('patternUnits', 'userSpaceOnUse');
      
    pattern.append('rect')
      .attr('width', 24)
      .attr('height', 24)
      .attr('fill', '#1e293b'); // slate-800
      
    const gIcon = pattern.append('g')
      .attr('stroke', '#334155') // slate-700
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round');
      
    gIcon.append('line').attr('x1', '2').attr('y1', '2').attr('x2', '22').attr('y2', '22');
    gIcon.append('path').attr('d', 'M8.5 16.5a5 5 0 0 1 7 0');
    gIcon.append('path').attr('d', 'M5 13a10 10 0 0 1 14 0');
    gIcon.append('path').attr('d', 'M2 8.8a15 15 0 0 1 20 0');
    gIcon.append('line').attr('x1', '12').attr('y1', '20').attr('x2', '12.01').attr('y2', '20');

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
          const statuses = this.countryStatuses[d.properties.name] || [];
          if (statuses.length === 0) return 'url(#no-data-pattern)';
          
          const uniqueStatuses = Array.from(new Set(statuses.map(s => s.status)));
          
          if (uniqueStatuses.length === 1) {
            return this.getColorHexForStatus(uniqueStatuses[0]);
          } else {
            const gradientId = `grad-${d.properties.name.replace(/[^a-zA-Z0-9]/g, '')}`;
            if (defs.select(`#${gradientId}`).empty()) {
              const grad = defs.append('linearGradient')
                .attr('id', gradientId)
                .attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
              
              uniqueStatuses.forEach((status, i) => {
                grad.append('stop')
                  .attr('offset', `${(i / uniqueStatuses.length) * 100}%`)
                  .attr('stop-color', this.getColorHexForStatus(status));
                grad.append('stop')
                  .attr('offset', `${((i + 1) / uniqueStatuses.length) * 100}%`)
                  .attr('stop-color', this.getColorHexForStatus(status));
              });
            }
            return `url(#${gradientId})`;
          }
        })
        .attr('stroke', '#0f172a') // slate-900
        .attr('stroke-width', 0.5)
        .attr('class', 'transition-colors duration-200')
        .on('mouseover', (event: MouseEvent, d: Feature) => {
          const statuses = this.countryStatuses[d.properties.name] || [];
          this.hoveredCountry.set({
            name: d.properties.name,
            statuses
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
          const statuses = this.countryStatuses[d.properties.name] || [];
          this.fetchCountryDetails(d.properties.name, statuses);
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

  private async getCountryStatuses(): Promise<Record<string, SourceStatus[]>> {
    if (!this.ai) {
      console.error('Gemini AI not initialized. Missing API key.');
      return {};
    }
    try {
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      
      // Fetch news from Tagesschau API
      const tagesschauPromise = fetch('https://www.tagesschau.de/api2u/news/?regions=9&ressort=ausland', {
        headers: { 'accept': 'application/json' }
      }).then(res => res.json()).catch(() => ({ news: [] }));

      // Fetch news from BBC via RSS-to-JSON (more reliable)
      const bbcNewsPromise = fetch('https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/world/rss.xml', {
        headers: { 'accept': 'application/json' }
      }).then(res => res.json())
        .catch(() => fetch(`${proxyUrl}${encodeURIComponent('https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/world/rss.xml')}`).then(res => res.json()))
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

      // Fetch news from AllAfrica via RSS-to-JSON
      const allAfricaPromise = fetch('https://api.rss2json.com/v1/api.json?rss_url=https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', {
        headers: { 'accept': 'application/json' }
      }).then(res => res.json())
        .catch(() => fetch(`${proxyUrl}${encodeURIComponent('https://api.rss2json.com/v1/api.json?rss_url=https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf')}`).then(res => res.json()))
        .catch(() => ({ items: [] }));

      // Fetch news from MercoPress via RSS-to-JSON
      const mercoPressPromise = fetch('https://api.rss2json.com/v1/api.json?rss_url=https://en.mercopress.com/rss/', {
        headers: { 'accept': 'application/json' }
      }).then(res => res.json())
        .catch(() => fetch(`${proxyUrl}${encodeURIComponent('https://api.rss2json.com/v1/api.json?rss_url=https://en.mercopress.com/rss/')}`).then(res => res.json()))
        .catch(() => ({ items: [] }));

      const [newsData, bbcData, nytData, guardianData, allAfricaData, mercoPressData] = await Promise.all([
        tagesschauPromise, 
        bbcNewsPromise, 
        nytPromise,
        guardianPromise,
        allAfricaPromise,
        mercoPressPromise
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
      
      // Extract AllAfrica news from RSS items
      const allAfricaArticles: AllAfricaNewsItem[] = [];
      if (allAfricaData && Array.isArray(allAfricaData.items)) {
        interface RssItem {
          title: string;
          description?: string;
          content?: string;
          link: string;
        }
        allAfricaData.items.forEach((item: RssItem) => {
          allAfricaArticles.push({
            title: item.title,
            summary: item.description || item.content || '',
            news_link: item.link
          });
        });
      }
      this.allAfricaNews = allAfricaArticles;

      // Extract MercoPress news from RSS items
      const mercoPressArticles: MercoPressNewsItem[] = [];
      if (mercoPressData && Array.isArray(mercoPressData.items)) {
        interface RssItem {
          title: string;
          description?: string;
          content?: string;
          link: string;
        }
        const stripHtml = (html: string) => {
          if (!html) return '';
          try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return doc.body.textContent || "";
          } catch {
            return html.replace(/<[^>]*>?/gm, '').trim();
          }
        };
        mercoPressData.items.forEach((item: RssItem) => {
          mercoPressArticles.push({
            title: item.title,
            summary: stripHtml(item.description || item.content || ''),
            news_link: item.link
          });
        });
      }
      this.mercoPressNews = mercoPressArticles;
      
      // Extract relevant text from news (only titles to save tokens and speed up processing)
      const tagesschauText = this.tagesschauNews.slice(0, 10).map((item) => 
        `Title: ${item.title}`
      ).join('\n');

      const bbcText = this.bbcNews.slice(0, 10).map((item) => 
        `Title: ${item.title}`
      ).join('\n');

      const nytText = this.nytNews.slice(0, 10).map((item) => 
        `Title: ${item.title}`
      ).join('\n');

      const guardianText = this.guardianNews.slice(0, 10).map((item) => 
        `Title: ${item.webTitle}`
      ).join('\n');

      const allAfricaText = this.allAfricaNews.slice(0, 10).map((item) => 
        `Title: ${item.title}`
      ).join('\n');

      const mercoPressText = this.mercoPressNews.slice(0, 10).map((item) => 
        `Title: ${item.title}`
      ).join('\n');

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Based on the following recent news headlines from Tagesschau, BBC, NYT, The Guardian, AllAfrica, and MercoPress, determine the current geopolitical status of countries worldwide. 
Evaluate the status of each country according to EACH individual news source that mentions it.
Categorize the status into one of four values: "war" (active major conflicts), "tense" (high tension, border skirmishes, significant internal unrest), "watch" (potential for instability, political crisis, emerging issues), or "stable" (specifically mentioned in the news as stable, peaceful, or having positive developments).
If a source does not mention a country, do not include that source for that country.
Return ONLY a JSON object containing an array of countries, where each country has a name and a list of statuses from the different sources. Ensure country names match standard English names (e.g., "Russia", "Ukraine", "Israel", "Palestine", "Sudan", "Taiwan").

Tagesschau News:
${tagesschauText}

BBC News:
${bbcText}

NYT News:
${nytText}

The Guardian News:
${guardianText}

AllAfrica News:
${allAfricaText}

MercoPress News:
${mercoPressText}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              countries: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Standard English country name" },
                    statuses: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          source: { type: Type.STRING, description: "Name of the news source (e.g., 'BBC', 'Tagesschau')" },
                          status: { type: Type.STRING, description: "One of: 'war', 'tense', 'watch', 'stable'" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      const result: Record<string, SourceStatus[]> = {};
      
      const normalize = (name: string) => name.toLowerCase().trim();
      
      if (data.countries && Array.isArray(data.countries)) {
        data.countries.forEach((c: { name: string; statuses: SourceStatus[] }) => {
          if (c.name && Array.isArray(c.statuses)) {
            result[c.name] = c.statuses;
          }
        });
      }
      
      const normalizedResult: Record<string, SourceStatus[]> = {};
      Object.entries(result).forEach(([key, value]) => {
        normalizedResult[normalize(key)] = value;
      });
      
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
