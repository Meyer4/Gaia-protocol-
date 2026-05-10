import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// the translations
const resources = {
  en: {
    translation: {
      "Global Overview": "Global Overview",
      "P2P Network": "P2P Network",
      "World Engine": "World Engine",
      "Sensor Grid": "Sensor Grid",
      "Trust & ZK Proofs": "Trust & ZK Proofs",
      "Console": "Console",
      "Settings": "Settings",
      "Guide & Onboarding": "Guide & Onboarding",
      "Gaia Protocol": "Gaia Protocol",
      "SYSTEM STATUS": "SYSTEM STATUS",
      "Node ID": "Node ID",
      "Mesh Peers": "Mesh Peers",
      "Hashrate": "Hashrate",
      "Query protocol...": "Query protocol...",
      "Settings Configuration": "Settings Configuration",
      "Language & Localization": "Language & Localization",
      "Select your preferred language.": "Select your preferred language.",
      "Location & Privacy": "Location & Privacy",
      "Use Location Services": "Use Location Services",
      "Force language update": "Force language update",
      "ZKP Explanation": "ZKP Explanation",
      "What is a Zero-Knowledge Proof?": "What is a Zero-Knowledge Proof?",
      "zkp_body": "A Zero-Knowledge Proof (ZKP) is a cryptographic method which allows one party (the prover) to prove to another party (the verifier) that a given statement is true, without revealing any specific information about the statement itself.",
      "Guide": "Guide",
      "How it works": "How it works: Gaia connects your compute to a global decentralized network. ZKP ensures your privacy. Use the menus to explore live sensors, compute power, and network status. The local node runs directly in your browser.",
      "Commercial Outreach": "Investor Outreach",
      "Generate Pitch": "Generate Pitch",
      "Pitch Target": "Pitch Target",
      "Target Persona": "Target Persona",
      "Draft Email": "Draft Email"
    }
  },
  es: {
    translation: {
      "Global Overview": "Resumen Global",
      "P2P Network": "Red P2P",
      "World Engine": "Motor Mundial",
      "Sensor Grid": "Red de Sensores",
      "Trust & ZK Proofs": "Confianza y Pruebas ZK",
      "Console": "Consola",
      "Settings": "Ajustes",
      "Guide & Onboarding": "Guía y Inicio",
      "Gaia Protocol": "Protocolo Gaia",
      "SYSTEM STATUS": "ESTADO DEL SISTEMA",
      "Node ID": "ID del Nodo",
      "Mesh Peers": "Nodos de Red",
      "Hashrate": "Tasa de Hash",
      "Query protocol...": "Consultar protocolo...",
      "Settings Configuration": "Configuración",
      "Language & Localization": "Idioma y Localización",
      "Select your preferred language.": "Seleccione su idioma preferido.",
      "Location & Privacy": "Ubicación y Privacidad",
      "Use Location Services": "Usar Servicios de Ubicación",
      "Force language update": "Forzar actualización de idioma",
      "ZKP Explanation": "Explicación ZKP",
      "What is a Zero-Knowledge Proof?": "¿Qué es una Prueba de Conocimiento Cero?",
      "zkp_body": "Una Prueba de Conocimiento Cero (ZKP) es un método criptográfico que permite a una de las partes probar a otra que una declaración es cierta, sin revelar ninguna información específica sobre la declaración en sí.",
      "Guide": "Guía",
      "How it works": "Cómo funciona: Gaia conecta tu computación a una red descentralizada global. ZKP asegura tu privacidad. Usa los menús para explorar. El nodo local se ejecuta directamente en tu navegador.",
      "Commercial Outreach": "Divulgación a Inversores",
      "Generate Pitch": "Generar Propuesta",
      "Pitch Target": "Objetivo de Propuesta",
      "Target Persona": "Persona Objetivo",
      "Draft Email": "Redactar Correo"
    }
  },
  fr: {
    translation: {
      "Global Overview": "Aperçu Mondial",
      "P2P Network": "Réseau P2P",
      "World Engine": "Moteur Mondial",
      "Sensor Grid": "Réseau de Capteurs",
      "Trust & ZK Proofs": "Confiance et Preuves ZK",
      "Console": "Console",
      "Settings": "Paramètres",
      "Guide & Onboarding": "Guide et Démarrage",
      "Gaia Protocol": "Protocole Gaia",
      "SYSTEM STATUS": "ÉTAT DU SYSTÈME",
      "Node ID": "ID du Nœud",
      "Mesh Peers": "Pairs Maillés",
      "Hashrate": "Taux de Hachage",
      "Query protocol...": "Interroger le protocole...",
      "Settings Configuration": "Configuration",
      "Language & Localization": "Langue et Localisation",
      "Select your preferred language.": "Sélectionnez votre langue de préférence.",
      "Location & Privacy": "Localisation et Confidentialité",
      "Use Location Services": "Utiliser les services de localisation",
      "Force language update": "Forcer la mise à jour de la langue",
      "ZKP Explanation": "Explication ZKP",
      "What is a Zero-Knowledge Proof?": "Qu'est-ce qu'une preuve à divulgation nulle ?",
      "zkp_body": "Une preuve à divulgation nulle (ZKP) est une méthode cryptographique qui permet à une partie de prouver à une autre qu'une déclaration est vraie sans rien révéler d'autre.",
      "Guide": "Guide",
      "How it works": "Comment ça marche : Gaia connecte votre calcul à un réseau mondial. ZKP assure votre confidentialité. Le nœud local fonctionne directement dans le navigateur.",
      "Commercial Outreach": "Sensibilisation des Investisseurs",
      "Generate Pitch": "Générer un Pitch",
      "Pitch Target": "Cible de Pitch",
      "Target Persona": "Personnalité Cible",
      "Draft Email": "Brouillon d'Email"
    }
  }
};

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: "en", // language to use
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
