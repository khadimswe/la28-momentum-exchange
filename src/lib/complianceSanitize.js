/**
 * Post-generation compliance filter for Gemini text (NGB names, Games terminology, etc.).
 */

export function sanitizeComplianceText(text) {
  if (text == null || text === '') return text
  if (typeof text !== 'string') return text
  return text
    .replace(/USA Badminton/g, 'Team USA badminton program')
    .replace(/USA Swimming/g, 'Team USA swimming program')
    .replace(/US(?:A)? Track (?:&|and) Field/gi, 'Team USA Athletics')
    .replace(/Track (?:&|and) Field/g, 'Athletics')
    .replace(/USA Wrestling/g, 'Team USA wrestling program')
    .replace(/USA Boxing/g, 'Team USA boxing program')
    .replace(/USA Cycling/g, 'Team USA cycling program')
    .replace(/USA Gymnastics/g, 'Team USA gymnastics program')
    .replace(/USA Volleyball/g, 'Team USA volleyball program')
    .replace(
      /USA (Hockey|Football|Basketball|Soccer|Tennis|Badminton|Fencing|Judo|Karate|Taekwondo)/gi,
      'Team USA $1 program',
    )
    .replace(/former Olympian/gi, 'Olympian')
    .replace(/former Paralympian/gi, 'Paralympian')
    .replace(/past Olympian/gi, 'Olympian')
    .replace(/past Paralympian/gi, 'Paralympian')
    .replace(/(\d{4}) Olympics/g, 'Olympic Games $1')
    .replace(/(\d{4}) Paralympics/g, 'Paralympic Games $1')
}
