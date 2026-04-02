import { Controller, Get } from '@nestjs/common';

@Controller('api/translate')
export class TranslateController {
  @Get('models')
  getModels() {
    return {
      models: [
        // 무료
        {
          id: 'gemini-flash-lite',
          name: 'Gemini 2.5 Flash-Lite',
          provider: 'google',
          category: 'fast',
          isFree: false,
          requiredKeyType: ['openrouterKey'],
        },
        {
          id: 'gemma-3n',
          name: 'Gemma 3n',
          provider: 'google',
          category: 'fast',
          isFree: true,
          requiredKeyType: null,
        },
        // 유료 Fast
        {
          id: 'gpt-4.1-nano',
          name: 'GPT-4.1 Nano',
          provider: 'openai',
          category: 'fast',
          isFree: false,
          requiredKeyType: ['openrouterKey'],
        },
        {
          id: 'claude-haiku',
          name: 'Claude Haiku 4.5',
          provider: 'anthropic',
          category: 'fast',
          isFree: false,
          requiredKeyType: ['openrouterKey'],
        },
        {
          id: 'mistral-small',
          name: 'Mistral Small',
          provider: 'mistral',
          category: 'fast',
          isFree: false,
          requiredKeyType: ['openrouterKey'],
        },
        {
          id: 'gemini-3-flash',
          name: 'Gemini 3 Flash',
          provider: 'google',
          category: 'fast',
          isFree: false,
          requiredKeyType: ['openrouterKey'],
        },
        {
          id: 'gpt-5-nano',
          name: 'GPT-5 Nano',
          provider: 'openai',
          category: 'fast',
          isFree: false,
          requiredKeyType: ['openrouterKey'],
        },
        // 유료 Premium
        {
          id: 'gemini-flash',
          name: 'Gemini 2.5 Flash',
          provider: 'google',
          category: 'premium',
          isFree: false,
          requiredKeyType: ['openrouterKey'],
        },
        {
          id: 'gpt-4.1-mini',
          name: 'GPT-4.1 Mini',
          provider: 'openai',
          category: 'premium',
          isFree: false,
          requiredKeyType: ['openrouterKey'],
        },
        {
          id: 'claude-sonnet',
          name: 'Claude Sonnet',
          provider: 'anthropic',
          category: 'premium',
          isFree: false,
          requiredKeyType: ['openrouterKey'],
        },
        {
          id: 'llama-3.3-70b',
          name: 'Llama 3.3 70B',
          provider: 'meta',
          category: 'premium',
          isFree: false,
          requiredKeyType: ['openrouterKey'],
        },
      ],
    };
  }
}
