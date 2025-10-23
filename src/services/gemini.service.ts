import { Injectable } from '@angular/core';
import { GoogleGenAI, Tool, Type } from '@google/genai';

// IMPORTANT: Add your Gemini API key here.
// To get an API key, visit https://makersuite.google.com/app/apikey
const API_KEY = "YOUR_GEMINI_API_KEY";

type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface AssistantResponse {
  transcription: string;
  text?: string;
  functionCall?: {
    name: string;
    args: { [key: string]: any };
  };
}

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // The user must replace 'YOUR_GEMINI_API_KEY' with their actual key.
    // The application will throw an API error at runtime if the key is invalid or missing.
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async generateVideo(
    prompt: string,
    aspectRatio: '16:9' | '9:16',
    imageBase64?: string,
    mimeType?: string
  ): Promise<string> {
    try {
      if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY') {
        throw new Error(
          'API_KEY not set. Please add your API key to src/services/gemini.service.ts'
        );
      }
      
      const payload: any = {
        model: 'veo-2.0-generate-001',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          aspectRatio: aspectRatio,
        },
      };

      if (imageBase64 && mimeType) {
        payload.image = {
          imageBytes: imageBase64,
          mimeType: mimeType,
        };
      }

      let operation = await this.ai.models.generateVideos(payload);

      console.log('Video generation started. Operation:', operation);

      while (!operation.done) {
        // Wait for 10 seconds before polling again.
        await new Promise((resolve) => setTimeout(resolve, 10000));
        operation = await this.ai.operations.getVideosOperation({
          operation: operation,
        });
        console.log('Polling... Operation status:', operation);
      }

      if (operation.error) {
        throw new Error(`Operation failed: ${operation.error.message}`);
      }

      const downloadLink =
        operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) {
        throw new Error(
          'Video generation succeeded, but no download link was found.'
        );
      }

      console.log('Video generated. Download link:', downloadLink);

      // Fetch the video data. The API key must be appended to the URI.
      const videoResponse = await fetch(`${downloadLink}&key=${API_KEY}`);
      if (!videoResponse.ok) {
        throw new Error(
          `Failed to download video: ${videoResponse.statusText}`
        );
      }

      const videoBlob = await videoResponse.blob();
      return URL.createObjectURL(videoBlob);
    } catch (error: any) {
      console.error('Error generating video:', error);

      // Stringify the entire error to reliably check for keywords.
      const errorString = JSON.stringify(error);

      if (
        errorString.includes('RESOURCE_EXHAUSTED') ||
        errorString.includes('quota exceeded')
      ) {
        throw new Error(
          'Video generation failed because the API usage quota has been exceeded. Please try again later.'
        );
      }

      // Try to extract a more specific message, falling back to the stringified version.
      const message = error?.error?.message || error?.message || errorString;
      throw new Error(`Failed to generate video: ${message}`);
    }
  }

  async editImage(
    editPrompt: string,
    originalImageBase64: string,
    originalMimeType: string,
    aspectRatio: ImageAspectRatio
  ): Promise<string> {
    try {
      if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY') {
        throw new Error(
          'API_KEY not set. Please add your API key to src/services/gemini.service.ts'
        );
      }
      // Step 1: Describe the original image using Gemini
      const describeResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              text: 'Describe this image in a concise but detailed paragraph. This description will be used to recreate the image.',
            },
            {
              inlineData: {
                mimeType: originalMimeType,
                data: originalImageBase64,
              },
            },
          ],
        },
      });
      const description = describeResponse.text;

      // Step 2: Create a new, detailed prompt for Imagen
      const finalPromptResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Based on the following image description and user request, create a new, single-paragraph, detailed prompt for an AI image generator.
          
          Original Description: "${description}"
          
          User Edit Request: "${editPrompt}"
          
          New Prompt:`,
        config: { temperature: 0.7 },
      });
      const finalPrompt = finalPromptResponse.text;

      console.log('Final image generation prompt:', finalPrompt);

      // Step 3: Generate the new image using Imagen
      const imageResponse = await this.ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: finalPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: aspectRatio,
        },
      });

      const newImageBase64 = imageResponse.generatedImages[0].image.imageBytes;
      if (!newImageBase64) {
        throw new Error(
          'Image generation succeeded, but no image data was returned.'
        );
      }
      return newImageBase64;
    } catch (error) {
      console.error('Error editing image:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to edit image: ${error.message}`);
      }
      throw new Error('An unknown error occurred during image editing.');
    }
  }

  async processAudio(
    audioBase64: string,
    mimeType: string
  ): Promise<AssistantResponse> {
    try {
      if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY') {
        throw new Error(
          'API_KEY not set. Please add your API key to src/services/gemini.service.ts'
        );
      }
      const tools: Tool[] = [
        {
          functionDeclarations: [
            {
              name: 'setMode',
              description:
                "Switches the user interface to a different mode or tab, such as 'video' generator, 'image' editor, or 'assistant'.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  mode: {
                    type: Type.STRING,
                    enum: ['video', 'image', 'assistant'],
                  },
                },
                required: ['mode'],
              },
            },
            {
              name: 'setPrompt',
              description:
                'Sets the text prompt for either the video generator or the image editor.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  prompt: {
                    type: Type.STRING,
                    description: 'The creative prompt text.',
                  },
                  target: {
                    type: Type.STRING,
                    enum: ['video', 'image'],
                    description: 'Which editor to set the prompt for.',
                  },
                },
                required: ['prompt', 'target'],
              },
            },
            {
              name: 'setAspectRatio',
              description:
                'Sets the aspect ratio for the video or image to be generated.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  aspectRatio: {
                    type: Type.STRING,
                    description:
                      "For video, '16:9' or '9:16'. For image, '1:1', '16:9', '9:16', '4:3', or '3:4'.",
                  },
                  target: {
                    type: Type.STRING,
                    enum: ['video', 'image'],
                    description: 'Which editor to set the aspect ratio for.',
                  },
                },
                required: ['aspectRatio', 'target'],
              },
            },
            {
              name: 'generate',
              description:
                'Starts the generation process for the currently configured video or image. The user must have already provided a prompt and uploaded an image.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  target: {
                    type: Type.STRING,
                    enum: ['video', 'image'],
                    description: 'Which generator to start.',
                  },
                },
                required: ['target'],
              },
            },
          ],
        },
      ];

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              text: "You are a helpful AI assistant for a creative studio. First, provide a verbatim transcription of the user's audio, followed by a newline character. Then, if the user's request requires an action, use the available tools. If not, provide a helpful text response.",
            },
            { inlineData: { mimeType: mimeType, data: audioBase64 } },
          ],
        },
        config: {
          tools: tools,
        },
      });

      const assistantResponse: AssistantResponse = {
        transcription: 'Could not transcribe audio.',
      };
      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) {
        throw new Error('Invalid response from Gemini API.');
      }

      const textPart = candidate.content.parts.find((p) => 'text' in p);
      const functionCallPart = candidate.content.parts.find(
        (p) => 'functionCall' in p
      );

      if (textPart?.text) {
        const [transcription, ...rest] = textPart.text.split('\n');
        assistantResponse.transcription = transcription.trim();
        const textResponse = rest.join('\n').trim();
        if (textResponse) {
          assistantResponse.text = textResponse;
        }
      }

      if (functionCallPart?.functionCall) {
        assistantResponse.functionCall = {
          name: functionCallPart.functionCall.name,
          args: functionCallPart.functionCall.args ?? {},
        };
        // If a function is being called, we don't need a text response,
        // as the client will provide a confirmation message.
        delete assistantResponse.text;
      }

      return assistantResponse;
    } catch (error) {
      console.error('Error processing audio:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to process audio: ${error.message}`);
      }
      throw new Error('An unknown error occurred while processing audio.');
    }
  }
}
