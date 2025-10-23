import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { GeminiService, AssistantResponse } from './services/gemini.service';

// Interface for uploaded file state
interface UploadedFile {
  name: string;
  base64: string;
  mimeType: string;
}

interface ChatMessage {
  speaker: 'user' | 'ai';
  text: string;
}

type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
type IntroStyle = 'cinematic' | 'electric' | 'watercolor';
type IntroDuration = 'short' | 'medium' | 'long';


@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private readonly geminiService = inject(GeminiService);
  private readonly sanitizer = inject(DomSanitizer);

  // Sound effects for the assistant
  private readonly assistantSoundStart = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YQQAAAAA//8=';
  private readonly assistantSoundEnd = 'data:audio/wav;base64,UklGRioAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YQUAAAAA/v8ADw==';
  private readonly introStartSound = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YQQAAAAA//8=';
  private readonly introSuccessSound = 'data:audio/wav;base64,UklGRlAAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YVIAAACAgIA/gD+AP4A/gD+AP4A/gD+AgICAgICAgD+AP4A/gD+AP4A/gD+AP4A/gICAgIA=';
  private readonly introErrorSound = 'data:audio/wav;base64,UklGRlAAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YVIAAAAAAAD/AAAA//8A/wD/AP8A/wD/AAAA/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/';

  // Intro screen visibility
  showIntro = signal(true);

  // App mode
  mode = signal<'video' | 'image' | 'assistant'>('video');

  // Common state
  uploadedFile = signal<UploadedFile | null>(null);
  error = signal<string | null>(null);

  // Video Form state
  videoSubject = signal<string>('');
  videoAspectRatio = signal<'16:9' | '9:16'>('16:9');
  introStyle = signal<IntroStyle>('cinematic');
  introDuration = signal<IntroDuration>('medium');
  uploadedSound = signal<UploadedFile | null>(null);
  uploadedSoundUrl = signal<SafeUrl | null>(null);
  exampleVideoSubjects = signal<string[]>([
    'A happy, red cartoon dog',
    'A majestic lion with a golden mane, roaring',
    'A steaming cup of coffee with a retro neon glow',
    'A sleek, futuristic logo with blue circuit lines',
  ]);

  // Image Editing State
  editPrompt = signal<string>('');
  imageAspectRatio = signal<ImageAspectRatio>('1:1');
  isEditing = signal(false);
  editedImage = signal<SafeUrl | null>(null);
  private editedImageBase64 = signal<string | null>(null);
  exampleEditPrompts = signal<string[]>([
    'Add a retro, vintage filter',
    'Make it look like a watercolor painting',
    'Change the background to a futuristic city',
    'Turn the main subject into a cartoon character',
  ]);

  // Video Generation state
  isGeneratingVideo = signal(false);
  generationStatus = signal('');
  
  // Video Result state
  generatedVideoUrl = signal<SafeUrl | null>(null);
  private videoBlobUrl = signal<string | null>(null);

  // Video player state
  isPlaying = signal(false);
  currentTime = signal(0);
  duration = signal(0);
  isMuted = signal(false);
  volume = signal(1);

  // AI Assistant state
  isRecording = signal(false);
  isAssistantResponding = signal(false);
  conversation = signal<ChatMessage[]>([
    {
      speaker: 'ai',
      text: "Hello! I'm your creative assistant. You can ask me for ideas, or tell me to change settings. For example, say 'Set the video subject to a futuristic city.' How can I help?"
    }
  ]);
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];


  ngOnInit(): void {
    // Hide the intro splash screen after a delay
    setTimeout(() => {
      this.showIntro.set(false);
    }, 2500);
  }

  setMode(newMode: 'video' | 'image' | 'assistant'): void {
    if (this.mode() === newMode) return;
    this.mode.set(newMode);
    this.error.set(null);
    // Stop any recording if switching modes
    if (this.isRecording()) {
      this.mediaRecorder?.stop();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const fullDataUrl = e.target.result as string;
        const base64 = fullDataUrl.split(',')[1];
        this.uploadedFile.set({
          name: file.name,
          base64: base64,
          mimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
    }
  }

  onSoundSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const fullDataUrl = e.target.result as string;
        const base64 = fullDataUrl.split(',')[1];
        this.uploadedSound.set({
          name: file.name,
          base64: base64,
          mimeType: file.type,
        });
        this.uploadedSoundUrl.set(this.sanitizer.bypassSecurityTrustUrl(fullDataUrl));
      };
      reader.readAsDataURL(file);
    }
  }

  // --- Video Generation Methods ---

  async generateVideo(): Promise<void> {
    const subject = this.videoSubject();
    if (!subject) {
      this.error.set('Please provide a subject for the intro.');
      return;
    }
    const currentFile = this.uploadedFile();

    // Construct the detailed prompt from UI selections
    const stylePrompts: Record<IntroStyle, string> = {
      cinematic: 'A cinematic, dramatic zoom into the subject, with epic lighting',
      electric: 'Electric energy and lightning courses through the subject, revealing it with a brilliant flash',
      watercolor: 'A beautiful watercolor splash on a paper texture, which resolves to perfectly reveal the subject',
    };
    const durationPrompts: Record<IntroDuration, string> = {
      short: 'The video should be a very short, impactful 3-second clip.',
      medium: 'The video should be a 5-second clip.',
      long: 'The video should be a slower, more cinematic 8-second shot.',
    };
    const finalPrompt = `${stylePrompts[this.introStyle()]}, featuring: "${subject}". ${durationPrompts[this.introDuration()]}`;
    console.log('Final video prompt:', finalPrompt);
    
    this.playSound(this.introStartSound);
    this.isGeneratingVideo.set(true);
    this.error.set(null);
    if (this.videoBlobUrl()) {
      URL.revokeObjectURL(this.videoBlobUrl()!);
    }
    this.generatedVideoUrl.set(null);
    this.videoBlobUrl.set(null);

    const messages = [
      'Contacting the AI model...',
      'Warming up the video generator...',
      'This can take a few minutes, please wait.',
      'Rendering frames...',
      'Finalizing the video...',
      'Almost there...',
    ];
    this.generationStatus.set(messages[0]);
    let messageIndex = 1;
    const intervalId = setInterval(() => {
      this.generationStatus.set(messages[messageIndex % messages.length]);
      messageIndex++;
    }, 8000);

    try {
      const blobUrl = await this.geminiService.generateVideo(
        finalPrompt,
        this.videoAspectRatio(),
        currentFile?.base64,
        currentFile?.mimeType
      );
      this.videoBlobUrl.set(blobUrl);
      this.generatedVideoUrl.set(
        this.sanitizer.bypassSecurityTrustUrl(blobUrl)
      );
      this.playSound(this.introSuccessSound);
    } catch (err) {
      this.playSound(this.introErrorSound);
      this.error.set(
        err instanceof Error ? err.message : 'An unknown error occurred.'
      );
    } finally {
      clearInterval(intervalId);
      this.isGeneratingVideo.set(false);
      this.generationStatus.set('');
    }
  }

  resetVideoForm(): void {
    if (this.videoBlobUrl()) {
      URL.revokeObjectURL(this.videoBlobUrl()!);
    }
    this.generatedVideoUrl.set(null);
    this.videoBlobUrl.set(null);
    this.videoSubject.set('');
    this.uploadedFile.set(null);
    this.uploadedSound.set(null);
    this.uploadedSoundUrl.set(null);
    this.error.set(null);
    this.videoAspectRatio.set('16:9');
    this.introStyle.set('cinematic');
    this.introDuration.set('medium');
    this.isPlaying.set(false);
    this.currentTime.set(0);
    this.duration.set(0);
  }

  downloadVideo(): void {
    const url = this.videoBlobUrl();
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ai-intro-video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  // --- Image Editing Methods ---

  async generateImage(): Promise<void> {
    const currentPrompt = this.editPrompt();
    const currentFile = this.uploadedFile();

    if (!currentPrompt || !currentFile) {
        this.error.set('Please provide an edit instruction and an image.');
        return;
    }

    this.isEditing.set(true);
    this.error.set(null);
    this.editedImage.set(null);
    this.editedImageBase64.set(null);

    try {
        const newImageBase64 = await this.geminiService.editImage(
            currentPrompt,
            currentFile.base64,
            currentFile.mimeType,
            this.imageAspectRatio()
        );
        this.editedImageBase64.set(newImageBase64);
        this.editedImage.set(this.sanitizer.bypassSecurityTrustUrl('data:image/png;base64,' + newImageBase64));
    } catch (err) {
        this.error.set(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
        this.isEditing.set(false);
    }
  }

  downloadImage(): void {
    const base64 = this.editedImageBase64();
    if (base64) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'image/png'});
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai-edited-image.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
  }

  resetImageEditor(): void {
      this.editedImage.set(null);
      this.editedImageBase64.set(null);
      this.editPrompt.set('');
      this.uploadedFile.set(null);
      this.error.set(null);
      this.imageAspectRatio.set('1:1');
  }


  // --- AI Assistant Methods ---
  async toggleRecording(): Promise<void> {
    if (this.isRecording()) {
      this.mediaRecorder?.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];
  
        this.mediaRecorder.ondataavailable = (event) => {
          this.audioChunks.push(event.data);
        };
  
        this.mediaRecorder.onstop = async () => {
          this.isRecording.set(false);
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64String = (reader.result as string).split(',')[1];
            this.isAssistantResponding.set(true);
            this.error.set(null);
  
            try {
              const result = await this.geminiService.processAudio(base64String, mimeType);
              
              if (result.transcription && result.transcription !== "Could not transcribe audio.") {
                this.conversation.update(c => [...c, { speaker: 'user', text: result.transcription }]);
              }

              if (result.functionCall) {
                this.handleFunctionCall(result.functionCall);
              } else if (result.text) {
                this.conversation.update(c => [...c, { speaker: 'ai', text: result.text! }]);
                this.speak(result.text);
              }

            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
              this.error.set(errorMessage);
              this.conversation.update(c => [...c, { speaker: 'ai', text: `Sorry, I encountered an error: ${errorMessage}` }]);
            } finally {
              this.isAssistantResponding.set(false);
            }
          };
          stream.getTracks().forEach(track => track.stop());
        };
  
        this.mediaRecorder.start();
        this.isRecording.set(true);
      } catch (err) {
        console.error('Error accessing microphone:', err);
        this.error.set('Could not access the microphone. Please grant permission and try again.');
      }
    }
  }

  private handleFunctionCall(functionCall: { name: string; args: any }): void {
    const { name, args } = functionCall;
    let confirmationMessage = '';
  
    switch (name) {
      case 'setMode':
        const mode = args.mode as 'video' | 'image' | 'assistant';
        if (['video', 'image', 'assistant'].includes(mode)) {
          this.setMode(mode);
          confirmationMessage = `Okay, I've switched to the ${mode} tab.`;
        } else {
          confirmationMessage = `Sorry, I can't find a tab named '${mode}'.`;
        }
        break;
  
      case 'setPrompt':
        const prompt = args.prompt as string;
        const promptTarget = args.target as 'video' | 'image';
        if (promptTarget === 'video') {
          this.videoSubject.set(prompt);
          confirmationMessage = `I've set the video subject.`;
          if (this.mode() !== 'video') this.setMode('video');
        } else if (promptTarget === 'image') {
          this.editPrompt.set(prompt);
          confirmationMessage = `I've set the image editing prompt.`;
          if (this.mode() !== 'image') this.setMode('image');
        } else {
          confirmationMessage = `Sorry, I don't know which prompt to set. Please specify 'video' or 'image'.`;
        }
        break;
  
      case 'setAspectRatio':
        const aspectRatio = args.aspectRatio as string;
        const ratioTarget = args.target as 'video' | 'image';
        if (ratioTarget === 'video') {
          const validRatios = ['16:9', '9:16'];
          if (validRatios.includes(aspectRatio)) {
            this.videoAspectRatio.set(aspectRatio as '16:9' | '9:16');
            confirmationMessage = `Video aspect ratio set to ${aspectRatio}.`;
            if (this.mode() !== 'video') this.setMode('video');
          } else {
            confirmationMessage = `Sorry, '${aspectRatio}' is not a valid ratio for video. Please use '16:9' or '9:16'.`;
          }
        } else if (ratioTarget === 'image') {
          const validRatios: ImageAspectRatio[] = ['1:1', '16:9', '9:16', '4:3', '3:4'];
          if (validRatios.includes(aspectRatio as ImageAspectRatio)) {
            this.imageAspectRatio.set(aspectRatio as ImageAspectRatio);
            confirmationMessage = `Image aspect ratio set to ${aspectRatio}.`;
            if (this.mode() !== 'image') this.setMode('image');
          } else {
            confirmationMessage = `Sorry, '${aspectRatio}' is not a valid ratio for images.`;
          }
        }
        break;
        
      case 'generate':
        const generateTarget = args.target as 'video' | 'image';
        if (generateTarget === 'video') {
          if (!this.videoSubject()) {
              confirmationMessage = "I can't start yet. Please set a subject first.";
          } else {
              this.setMode('video');
              this.generateVideo();
              confirmationMessage = "Okay, starting intro generation. This could take a few minutes.";
          }
        } else if (generateTarget === 'image') {
          if (!this.uploadedFile() || !this.editPrompt()) {
              confirmationMessage = "I can't start yet. Please upload an image and set an editing prompt first.";
          } else {
              this.setMode('image');
              this.generateImage();
              confirmationMessage = "Okay, I'm editing the image now.";
          }
        }
        break;
  
      default:
        confirmationMessage = `Sorry, I can't perform the action '${name}'.`;
    }
    
    if (confirmationMessage) {
      this.conversation.update(c => [...c, { speaker: 'ai', text: confirmationMessage }]);
      this.speak(confirmationMessage);
    }
  }

  private playSound(soundUrl: string): void {
    try {
      if (soundUrl) {
        const audio = new Audio(soundUrl);
        audio.play().catch(e => console.error("Error playing sound:", e));
      }
    } catch (e) {
      console.error("Could not create audio object", e);
    }
  }

  private speak(text: string): void {
    if ('speechSynthesis' in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';

      // Play a sound when the speech finishes
      utterance.onend = () => {
        this.playSound(this.assistantSoundEnd);
      };

      // Play a sound when the speech starts
      this.playSound(this.assistantSoundStart);
      window.speechSynthesis.speak(utterance);

    } else if (!text) {
      console.warn('Speak function called with empty text.');
    } else {
      console.warn('Text-to-speech not supported in this browser.');
    }
  }


  // --- Video Player Controls ---
  togglePlayPause(video: HTMLVideoElement, audio?: HTMLAudioElement): void {
    if (video.paused) {
      video.play();
      if (audio?.src) audio.play().catch(e => console.error("Audio play failed", e));
    } else {
      video.pause();
      if (audio?.src) audio.pause();
    }
  }

  onLoadedMetadata(video: HTMLVideoElement): void {
    this.duration.set(video.duration);
  }

  onTimeUpdate(video: HTMLVideoElement): void {
    this.currentTime.set(video.currentTime);
  }

  onSeek(event: Event, video: HTMLVideoElement, audio?: HTMLAudioElement): void {
    const input = event.target as HTMLInputElement;
    const newTime = Number(input.value);
    video.currentTime = newTime;
    if (audio?.src) {
        audio.currentTime = newTime;
    }
  }

  toggleMute(audio: HTMLAudioElement): void {
    audio.muted = !audio.muted;
    this.isMuted.set(audio.muted);
  }

  onVolumeChange(event: Event, audio: HTMLAudioElement): void {
    const input = event.target as HTMLInputElement;
    const newVolume = Number(input.value);
    audio.volume = newVolume;
    this.volume.set(newVolume);
    if (newVolume > 0 && audio.muted) {
      audio.muted = false;
      this.isMuted.set(false);
    } else if (newVolume === 0 && !audio.muted) {
      audio.muted = true;
      this.isMuted.set(true);
    }
  }

  formatTime(timeInSeconds: number): string {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) {
      return '0:00';
    }
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}