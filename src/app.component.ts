import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
  OnDestroy,
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
type AppMode = 'video' | 'image' | 'assistant';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly geminiService = inject(GeminiService);
  private readonly sanitizer = inject(DomSanitizer);

  // Sound effects - Replaced with new valid, clean base64 data
  private readonly assistantSoundStart = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YQQAAAAAAAB/AAAB';
  private readonly assistantSoundEnd = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YQQAAAAAAAD/AAAA/w==';
  private readonly introStartSound = 'data:audio/wav;base64,UklGRqQAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YZgAAAD8/v39/v7+/v79/v3+/Pz7+/v6+fr5+fj4+Pf3+fb2+fX1+fT0+fPy+fLx+fDv+fDu+e/t+e7s+e3r+evq+er自家+ejo+efn+efm+ebl+eXk+eTj+ePi+eHg+eDf+d/e+d/d+d7c+d3b+dza+dzY+dvX+drW+dnV+djU+dfT+dbS+dTQ+dPO+dLM+dHK+dHG+dDD+c++AgECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==';
  private readonly introSuccessSound = 'data:audio/wav;base64,UklGRkIAAABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABAAZGF0YYwBAACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIAAAICAgACAgIA-';
  private readonly introErrorSound = 'data:audio/wav;base64,UklGRlwBAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YVABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA==';

  // Component state signals
  showIntro = signal(true);
_mode: AppMode = 'video';
  mode = signal<AppMode>('video');
  error = signal<string | null>(null);

  // Video Generator State
  isGeneratingVideo = signal(false);
  generationStatus = signal('');
  uploadedFile = signal<UploadedFile | null>(null);
  uploadedSound = signal<UploadedFile | null>(null);
  uploadedSoundUrl = signal<SafeUrl | null>(null);
  videoSubject = signal('a neon hologram of a cat driving at top speed');
  videoAspectRatio = signal<'16:9' | '9:16'>('16:9');
  introStyle = signal<IntroStyle>('electric');
  introDuration = signal<IntroDuration>('medium');
  generatedVideoUrl = signal<SafeUrl | null>(null);
  exampleVideoSubjects = signal([
    'A majestic lion roaring on a mountain',
    'A futuristic cityscape at night',
    'An abstract explosion of colors',
    'A hummingbird in slow motion',
  ]);

  // Video Player State
  isPlaying = signal(false);
  isMuted = signal(false);
  volume = signal(0.75);
  currentTime = signal(0);
  duration = signal(0);

  // Image Editor State
  isEditing = signal(false);
  editPrompt = signal('Change the background to a snowy mountain.');
  imageAspectRatio = signal<ImageAspectRatio>('1:1');
  editedImage = signal<string | null>(null);
  exampleEditPrompts = signal([
    'Make it look like an oil painting',
    'Add a vintage, sepia tone filter',
    'Turn the subject into a cartoon character',
    'Place the subject on a tropical beach',
  ]);

  // AI Assistant State
  isRecording = signal(false);
  isAssistantResponding = signal(false);
  conversation = signal<ChatMessage[]>([]);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  ngOnInit() {
    // Hide the intro splash screen after a delay
    setTimeout(() => this.showIntro.set(false), 2000);
  }

  ngOnDestroy() {
    // Clean up media recorder resources
    this.stopRecording();
  }

  // --- Common Methods ---

  setMode(newMode: AppMode) {
    this.mode.set(newMode);
    this.error.set(null); // Clear errors when switching modes
    // Reset forms when switching modes to avoid confusion
    this.resetVideoForm(false);
    this.resetImageEditor(false);
    if (newMode === 'assistant' && this.conversation().length === 0) {
      this.conversation.set([
        { speaker: 'ai', text: 'Hello! How can I help you today? You can ask me to switch tabs, set prompts, and generate content.' }
      ]);
    }
  }

  private playSound(sound: string) {
    new Audio(sound).play().catch(e => console.error("Error playing sound:", e));
  }
  
  // --- File Handling ---

  // Fix: Changed parameter type from File to Blob to accommodate audio recordings.
  private async fileToBase64(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      try {
        const base64 = await this.fileToBase64(file);
        this.uploadedFile.set({ name: file.name, base64, mimeType: file.type });
      } catch (err) {
        this.error.set('Failed to read the selected file.');
        console.error(err);
      }
    }
  }
  
  async onSoundSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      try {
        const base64 = await this.fileToBase64(file);
        this.uploadedSound.set({ name: file.name, base64, mimeType: file.type });
        const objectUrl = URL.createObjectURL(file);
        this.uploadedSoundUrl.set(this.sanitizer.bypassSecurityTrustUrl(objectUrl));
      } catch (err) {
        this.error.set('Failed to read the selected sound file.');
        console.error(err);
      }
    }
  }

  // --- Video Generation ---

  async generateVideo() {
    const subject = this.videoSubject();
    if (!subject) {
      this.error.set('Please describe your subject before generating.');
      return;
    }

    this.isGeneratingVideo.set(true);
    this.error.set(null);
    this.playSound(this.introStartSound);

    try {
      this.generationStatus.set('Crafting a detailed prompt for the AI...');
      const durationText =
        this.introDuration() === 'short'
          ? '3-4 seconds'
          : this.introDuration() === 'medium'
          ? '5-6 seconds'
          : '8-10 seconds';
      
      let finalPrompt = `Create a ${this.introStyle()}, professional intro video, approximately ${durationText} long. The subject is "${subject}".`;

      if(this.uploadedFile()){
        finalPrompt += " The intro should prominently feature the provided logo/image, integrating it naturally with the animation."
      } else {
         finalPrompt += " The intro should focus solely on the animated subject, ending with a clear, visually appealing moment."
      }
      
      this.generationStatus.set('Sending request to the video model...');
      const videoUrl = await this.geminiService.generateVideo(
        finalPrompt,
        this.videoAspectRatio(),
        this.uploadedFile()?.base64,
        this.uploadedFile()?.mimeType,
      );
      this.generatedVideoUrl.set(this.sanitizer.bypassSecurityTrustUrl(videoUrl));
      this.playSound(this.introSuccessSound);
    } catch (err) {
      this.error.set((err as Error).message);
      this.playSound(this.introErrorSound);
    } finally {
      this.isGeneratingVideo.set(false);
      this.generationStatus.set('');
    }
  }

  resetVideoForm(fullReset = true) {
    this.isGeneratingVideo.set(false);
    this.generatedVideoUrl.set(null);
    if (fullReset) {
      this.uploadedFile.set(null);
      this.uploadedSound.set(null);
      this.uploadedSoundUrl.set(null);
      this.videoSubject.set('');
    }
  }
  
  downloadVideo() {
    const url = this.generatedVideoUrl() as string;
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'red1-intro.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Note: We don't revoke the object URL here so the video can still be played.
    }
  }
  
  // --- Video Player Controls ---

  togglePlayPause(video: HTMLVideoElement, audio: HTMLAudioElement) {
    if (video.paused) {
      video.play();
      if(this.uploadedSoundUrl()) audio.play();
    } else {
      video.pause();
      if(this.uploadedSoundUrl()) audio.pause();
    }
  }
  
  onTimeUpdate(video: HTMLVideoElement) {
    this.currentTime.set(video.currentTime);
  }

  onLoadedMetadata(video: HTMLVideoElement) {
    this.duration.set(video.duration);
  }

  onSeek(event: Event, video: HTMLVideoElement, audio: HTMLAudioElement) {
    const time = parseFloat((event.target as HTMLInputElement).value);
    video.currentTime = time;
    if(this.uploadedSoundUrl()) audio.currentTime = time;
    this.currentTime.set(time);
  }
  
  toggleMute(audio: HTMLAudioElement) {
    audio.muted = !audio.muted;
    this.isMuted.set(audio.muted);
  }
  
  onVolumeChange(event: Event, audio: HTMLAudioElement) {
    const volumeLevel = parseFloat((event.target as HTMLInputElement).value);
    audio.volume = volumeLevel;
    this.volume.set(volumeLevel);
    if (volumeLevel > 0 && audio.muted) {
      audio.muted = false;
      this.isMuted.set(false);
    }
  }
  
  formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  }


  // --- Image Editing ---

  async generateImage() {
    const file = this.uploadedFile();
    const prompt = this.editPrompt();
    if (!file || !prompt) {
      this.error.set('Please upload an image and provide an edit prompt.');
      return;
    }
    this.isEditing.set(true);
    this.error.set(null);
    this.playSound(this.introStartSound);

    try {
      const base64Image = await this.geminiService.editImage(
        prompt,
        file.base64,
        file.mimeType,
        this.imageAspectRatio()
      );
      this.editedImage.set('data:image/png;base64,' + base64Image);
      this.playSound(this.introSuccessSound);
    } catch (err) {
      this.error.set((err as Error).message);
      this.playSound(this.introErrorSound);
    } finally {
      this.isEditing.set(false);
    }
  }

  resetImageEditor(fullReset = true) {
    this.isEditing.set(false);
    this.editedImage.set(null);
    if (fullReset) {
      this.uploadedFile.set(null);
      this.editPrompt.set('');
    }
  }
  
  downloadImage() {
    const url = this.editedImage();
    if (url) {
      const a = document.createElement('a');
a.href = url;
      a.download = 'red1-edited-image.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  // --- AI Assistant ---

  async toggleRecording() {
    if (this.isRecording()) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.error.set('Audio recording is not supported by your browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };
      this.mediaRecorder.onstop = () => this.processRecording();
      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.playSound(this.assistantSoundStart);
    } catch (err) {
      this.error.set('Could not access microphone. Please grant permission.');
      console.error('Microphone access error:', err);
    }
  }

  private stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      this.playSound(this.assistantSoundEnd);
    }
     if (this.mediaRecorder) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        this.mediaRecorder = null;
    }
  }
  
  private async processRecording() {
    if (this.audioChunks.length === 0) return;

    this.isAssistantResponding.set(true);
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    this.audioChunks = [];

    try {
      const base64 = await this.fileToBase64(audioBlob);
      const result = await this.geminiService.processAudio(base64, audioBlob.type);
      
      this.conversation.update(c => [...c, { speaker: 'user', text: result.transcription }]);
      
      // Give the UI a moment to update before showing the AI response
      setTimeout(() => {
        this.handleAssistantResponse(result);
        this.isAssistantResponding.set(false);
      }, 500);

    } catch (err) {
      this.error.set((err as Error).message);
      this.isAssistantResponding.set(false);
    }
  }
  
  private handleAssistantResponse(response: AssistantResponse) {
    if(response.text) {
      this.conversation.update(c => [...c, { speaker: 'ai', text: response.text! }]);
    }
    
    if (response.functionCall) {
      const { name, args } = response.functionCall;
      let confirmationText = '';
      
      switch(name) {
        case 'setMode':
          this.setMode(args['mode']);
          confirmationText = `Okay, I've switched to the ${args['mode']} tab.`;
          break;
        case 'setPrompt':
          if (args['target'] === 'video') this.videoSubject.set(args['prompt']);
          else this.editPrompt.set(args['prompt']);
          confirmationText = `Alright, I've set the ${args['target']} prompt.`;
          break;
        case 'setAspectRatio':
           if (args['target'] === 'video') this.videoAspectRatio.set(args['aspectRatio']);
           else this.imageAspectRatio.set(args['aspectRatio']);
           confirmationText = `Done. The ${args['target']} aspect ratio is now ${args['aspectRatio']}.`;
           break;
        case 'generate':
          if (args['target'] === 'video') this.generateVideo();
          else this.generateImage();
          confirmationText = `Okay, I'm starting the ${args['target']} generation now.`;
          break;
        default:
          confirmationText = "Sorry, I'm not sure how to do that.";
      }
      this.conversation.update(c => [...c, { speaker: 'ai', text: confirmationText }]);
    }
  }
}
