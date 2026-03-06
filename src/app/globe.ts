import {ChangeDetectionStrategy, Component, ElementRef, viewChild, signal, afterNextRender} from '@angular/core';
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

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-globe',
  template: `
    <div class="relative w-full h-[600px] flex flex-col items-center justify-center bg-slate-900 rounded-xl overflow-hidden">
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

            <!-- Tabs -->
            <div class="flex border-b border-slate-700 mb-4 overflow-x-auto no-scrollbar">
              <button (click)="activeTab.set('analysis')" 
                class="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
                [class.text-white]="activeTab() === 'analysis'"
                [class.border-b-2]="activeTab() === 'analysis'"
                [class.border-white]="activeTab() === 'analysis'"
                [class.text-slate-500]="activeTab() !== 'analysis'">
                Analysis
              </button>
              <button (click)="activeTab.set('tagesschau')" 
                class="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
                [class.text-white]="activeTab() === 'tagesschau'"
                [class.border-b-2]="activeTab() === 'tagesschau'"
                [class.border-white]="activeTab() === 'tagesschau'"
                [class.text-slate-500]="activeTab() !== 'tagesschau'">
                Tagesschau
              </button>
              <button (click)="activeTab.set('bbc')" 
                class="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
                [class.text-white]="activeTab() === 'bbc'"
                [class.border-b-2]="activeTab() === 'bbc'"
                [class.border-white]="activeTab() === 'bbc'"
                [class.text-slate-500]="activeTab() !== 'bbc'">
                BBC
              </button>
              <button (click)="activeTab.set('nyt')" 
                class="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
                [class.text-white]="activeTab() === 'nyt'"
                [class.border-b-2]="activeTab() === 'nyt'"
                [class.border-white]="activeTab() === 'nyt'"
                [class.text-slate-500]="activeTab() !== 'nyt'">
                NYT
              </button>
            </div>
            
            @if (countryDetailsLoading()) {
              <div class="flex flex-col items-center justify-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mb-4"></div>
                <p class="text-sm text-slate-400 animate-pulse">Gathering latest news...</p>
              </div>
            } @else {
              @if (activeTab() === 'analysis') {
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
              }
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class Globe {
  private globeContainer = viewChild.required<ElementRef>('globeContainer');
  private ai!: GoogleGenAI;
  
  loading = signal(true);
  hoveredCountry = signal<{name: string, status: string} | null>(null);
  selectedCountry = signal<{name: string, status: string} | null>(null);
  countryDetailsLoading = signal(false);
  countryDetails = signal<string | null>(null);
  activeTab = signal<'analysis' | 'tagesschau' | 'bbc' | 'nyt'>('analysis');
  nytApiKeyMissing = signal(false);
  
  filteredTagesschau = signal<TagesschauNewsItem[]>([]);
  filteredBbc = signal<BbcNewsItem[]>([]);
  filteredNyt = signal<NytArticle[]>([]);
  
  private tagesschauNews: TagesschauNewsItem[] = [];
  private bbcNews: BbcNewsItem[] = [];
  private nytNews: NytArticle[] = [];

  constructor() {
    if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});
    } else {
      console.error('GEMINI_API_KEY is not defined.');
    }
    afterNextRender(() => {
      this.renderGlobe();
    });
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
    this.activeTab.set('analysis');
    
    if (!this.ai) {
      this.countryDetails.set('Error: Gemini API key is missing.');
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

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Based on the following recent news from Tagesschau, BBC, and NYT (if any) and your general knowledge, provide a brief, 2-3 paragraph summary of the current geopolitical situation in ${name}. It is currently marked as "${status}". Focus on conflicts, tensions, or political instability. Do not use markdown formatting like bolding or headers, just plain text paragraphs.\n\nRecent News for ${name}:\n${newsContext || 'No specific recent news found in the latest feeds.'}`,
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
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 600;
    
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

    try {
      // Fetch world data
      const world = await d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson') as {features: Feature[]};

      // Get country statuses from Gemini using real-time search
      const statuses = await this.getCountryStatuses();
      
      this.loading.set(false);

      // Draw countries
      g.selectAll('path')
        .data(world.features)
        .enter()
        .append('path')
        .attr('d', (d: Feature) => path(d as unknown as d3.GeoPermissibleObjects) || '')
        .attr('fill', (d: Feature) => {
          const status = statuses[d.properties.name];
          if (status === 'war') return '#ef4444'; // red-500
          if (status === 'tense') return '#f97316'; // orange-500
          if (status === 'watch') return '#facc15'; // yellow-400
          return '#475569'; // slate-600
        })
        .attr('stroke', '#0f172a') // slate-900
        .attr('stroke-width', 0.5)
        .attr('class', 'transition-colors duration-200')
        .on('mouseover', (event: MouseEvent, d: Feature) => {
          const status = statuses[d.properties.name];
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
          const status = statuses[d.properties.name] || 'stable';
          this.fetchCountryDetails(d.properties.name, status);
        });

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

    } catch (error) {
      console.error('Error rendering globe:', error);
      this.loading.set(false);
    }
  }

  private async getCountryStatuses(): Promise<Record<string, string>> {
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

      // Fetch news from BBC API (News and Latest)
      const bbcNewsPromise = fetch('https://bbc-news-api.vercel.app/news?lang=english', {
        headers: { 'accept': 'application/json' }
      }).then(res => res.json())
        .catch(() => fetch(`${proxyUrl}${encodeURIComponent('https://bbc-news-api.vercel.app/news?lang=english')}`).then(res => res.json()))
        .catch(() => ({}));

      const bbcLatestPromise = fetch('https://bbc-news-api.vercel.app/latest?lang=english', {
        headers: { 'accept': 'application/json' }
      }).then(res => res.json())
        .catch(() => fetch(`${proxyUrl}${encodeURIComponent('https://bbc-news-api.vercel.app/latest?lang=english')}`).then(res => res.json()))
        .catch(() => ({}));

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

      const [newsData, bbcNewsData, bbcLatestData, nytData] = await Promise.all([
        tagesschauPromise, 
        bbcNewsPromise, 
        bbcLatestPromise, 
        nytPromise
      ]);
      
      this.tagesschauNews = newsData.news || [];
      
      // Extract BBC news from all sections (dynamic keys) from both endpoints
      const bbcArticles: BbcNewsItem[] = [];
      const processBbc = (data: Record<string, unknown>) => {
        if (data) {
          Object.keys(data).forEach(key => {
            const items = data[key];
            if (Array.isArray(items)) {
              items.forEach((item: BbcNewsItem) => {
                // Sanitize links
                if (item.news_link?.includes('https://bbc.comhttps://')) {
                  item.news_link = item.news_link.replace('https://bbc.comhttps://', 'https://');
                }
                bbcArticles.push(item);
              });
            }
          });
        }
      };
      processBbc(bbcNewsData as Record<string, unknown>);
      processBbc(bbcLatestData as Record<string, unknown>);
      
      // Deduplicate BBC articles by news_link
      const uniqueBbc = Array.from(new Map(bbcArticles.map(item => [item.news_link, item])).values());
      this.bbcNews = uniqueBbc;
      this.nytNews = nytData.results || [];
      
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

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Based on the following recent news from Tagesschau, BBC, and NYT, determine the current geopolitical status of countries worldwide. Categorize countries into three lists: "war" (active major conflicts), "tense" (high tension, border skirmishes, significant internal unrest), and "watch" (potential for instability, political crisis, emerging issues). Return ONLY a JSON object with these three arrays of country names. Ensure country names match standard English names (e.g., "Russia", "Ukraine", "Israel", "Palestine", "Sudan", "Taiwan").\n\nTagesschau News:\n${tagesschauText}\n\nBBC News:\n${bbcText}\n\nNYT News:\n${nytText}`,
        config: {
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
