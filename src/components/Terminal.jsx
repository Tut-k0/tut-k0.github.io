import { useState, useEffect, useRef } from 'react';
import {TerminalIcon} from "lucide-react";

const HeroSection = () => {
    const [input, setInput] = useState('');
    const [history, setHistory] = useState([]);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const inputRef = useRef(null);
    const terminalRef = useRef(null);

    const commands = {
        whoami: {
            description: 'Display user information',
            output: [
                'David Chandler',
                '• Offensive Security Engineer',
                '• Specializing in Penetration Testing, Red Teaming, and Vulnerability Assessment',
                '• Occasionally creating software and fun projects on the side',
                '• Always doing CTFs when time permits...'
            ]
        },
        help: {
            description: 'List all available commands',
            output: [
                'Available commands:',
                '  help          - Show this help message',
                '  whoami        - Display user information',
                '  clear         - Clear the terminal',
                '  projects      - List notable projects',
                '  certifications- Show professional certifications',
                '  skills        - Display technical skills',
                '  experience    - Show work history',
                '',
                'Type any command to get started!'
            ]
        },
        projects: {
            description: 'List notable projects',
            output: [
                '📁 Notable Projects:',
                '',
                '1. Hack The Box Academy to Markdown',
                '   • Fetch down Academy modules as markdown files for local use',
                '   • Built with Go',
                '   -- https://github.com/Tut-k0/htb-academy-to-md',
                '',
                '2. Game Role Attendant',
                '   • A web app assisting in role-based hidden identity games',
                '   • Node.js Backend, Quasar Vue Frontend',
                '   • This project is more of a demo to get familiar with JS and WebSockets',
                '   -- https://github.com/dme998/game-role-attendant',
                '',
                '• More interesting projects are being worked on...'
            ]
        },
        certifications: {
            description: 'Show professional certifications',
            output: [
                '🏅 Certifications:',
                '',
                '• CPTS - Certified Penetration Testing Specialist',
                '• Security+ - CompTia Sec+',
                '',
                '🏅 Hack The Box Pro Labs Completed:',
                '',
                '• BlackSky Hailstorm - AWS lab focusing on compromising various AWS services.',
                '• BlackSky Cyclone - Azure lab focusing on compromising various Azure services.',
                '• BlackSky Blizzard - GCP lab focusing on compromising various GCP services.'
            ]
        },
        skills: {
            description: 'Display technical skills',
            output: [
                '🔧 Technical Skills:',
                '',
                '• Languages: Python, Go, JavaScript, C, C#',
                '• Red Team: Malware Development, C2 Infrastructure, Tool Obfuscation',
                '• Web: React, Vue, REST, GraphQL, Web Security',
                '• Cloud: AWS, Azure, GCP, Cloud Security',
                '• Tools: Too many to list... shout-out to Nmap and Burp Suite!',
                '• Other: Linux, Docker, CI/CD, Databases, Software Dev Methodologies/Tools'
            ]
        },
        experience: {
            description: 'Show work history',
            output: [
                '💼 Work Experience:',
                '',
                'Apr 2023 - Present | Offensive Security Engineer @ Emerson',
                '• Leading pen-testing and red team engagements',
                '• Developing custom offensive security tools',
                '• Collaborating with the defensive team in Purple Team engagements',
                '• Performing Threat Models with development teams',
                '• Recent vulnerability and exploit analysis',
                '',
                'Sep 2022 - Apr 2023 | Attack Surface Security Analyst @ Emerson',
                '• Managing perimeter security via discovery, analysis, remediation and monitoring',
                '• Writing Python scripts to pull data from 3rd party APIs',
                '• Creating visual reports based on attack surface findings',
                '• Staying up to date on recent threats giving analysis on exploits',
                '',
                'Oct 2020 - Sep 2022 | IT Quality Assurance Analyst @ QUES',
                '• Developing T-SQL stored procedures',
                '• Writing and maintaining functional and UI automation tests',
                '• Writing and maintaining an API load testing suite',
                '• Lead QA tester on new applications',
                '• Minor development work using Unity and Blender',
                '• Working with developers by reviewing code + writing tests',
                '• Auditing application security in down time + remediating issues',
            ]
        },
        clear: {
            description: 'Clear the terminal',
            output: []
        },
        secret: {
            description: '',
            output: [
                '👀 You... I like you... 👀',
            ]
        },
        ls: {
            description: '',
            output: [
                '📁 No files here... 📁',
            ]
        },
        "cat flag.txt": {
            description: '',
            output: [
                '🟢 Ah, I see you are a cultured individual as well! 🟢',
                'FLAG{Y0uF0uNdTh3S3cr3tFunc710n}'
            ]
        }
    };

    // URL regex pattern
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

    // Helper function to parse text and return segments with URLs identified
    const parseTextWithLinks = (text) => {
        let segments = [];
        let lastIndex = 0;

        // Function to add matched URL
        const addMatch = (match, index) => {
            if (index > lastIndex) {
                segments.push({
                    type: 'text',
                    content: text.slice(lastIndex, index)
                });
            }
            segments.push({
                type: 'link',
                content: match,
                href: match.startsWith('http') ? match : `https://${match}`
            });
            lastIndex = index + match.length;
        };

        // Find URLs
        let match;
        while ((match = urlPattern.exec(text)) !== null) {
            addMatch(match[0], match.index);
        }

        // Add remaining text
        if (lastIndex < text.length) {
            segments.push({
                type: 'text',
                content: text.slice(lastIndex)
            });
        }

        return segments.length > 0 ? segments : [{ type: 'text', content: text }];
    };

    const handleCommand = (cmd) => {
        const trimmedCmd = cmd.trim().toLowerCase();
        let output = [];

        if (trimmedCmd === 'clear') {
            setHistory([]);
            return;
        }

        if (trimmedCmd === '') {
            output = [''];
        } else if (commands[trimmedCmd]) {
            output = commands[trimmedCmd].output;
        } else {
            output = [`Command not found: ${trimmedCmd}. Type 'help' for available commands.`];
        }

        setHistory(prev => [...prev,
            { type: 'input', content: cmd },
            { type: 'output', content: output }
        ]);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleCommand(input);
            setCommandHistory(prev => [...prev, input]);
            setHistoryIndex(-1);
            setInput('');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex + 1;
                if (newIndex < commandHistory.length) {
                    setHistoryIndex(newIndex);
                    setInput(commandHistory[commandHistory.length - 1 - newIndex]);
                }
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(commandHistory[commandHistory.length - 1 - newIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setInput('');
            }
        }
    };

    useEffect(() => {
        terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight);
    }, [history]);

    const focusInput = () => {
        inputRef.current?.focus();
    };

    const OutputLine = ({ line }) => {
        if (line === '') {
            return <div className="h-4"></div>;
        }

        const segments = parseTextWithLinks(line);

        return (
            <div className="flex flex-wrap">
                {segments.map((segment, index) => (
                    segment.type === 'link' ? (
                        <a
                            key={index}
                            href={segment.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-400 hover:text-green-300 hover:underline cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {segment.content}
                        </a>
                    ) : (
                        <span key={index}>{segment.content}</span>
                    )
                ))}
            </div>
        );
    };

    return (
        <div className="w-full max-w-4xl mx-auto text-green-400">
            <div className="flex items-center mb-6">
                <TerminalIcon className="w-6 h-6 mr-2" />
                <h1 className="text-xl font-mono">root@dc-tech:~#</h1>
            </div>

            <div
                className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-xl border border-gray-700 min-h-[50vh] max-h-[50vh] overflow-y-auto"
                ref={terminalRef}
                onClick={focusInput}
            >
                <div className="font-mono">
                    {history.map((entry, i) => (
                        <div key={i} className="mb-2">
                            {entry.type === 'input' ? (
                                <div className="flex">
                                    <span className="text-purple-400">➜ </span>
                                    <span className="ml-2">{entry.content}</span>
                                </div>
                            ) : (
                                <div className="ml-4 space-y-1">
                                    {entry.content.map((line, j) => (
                                        <OutputLine key={j} line={line} />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    <div className="flex items-center">
                        <span className="text-purple-400">➜ </span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="ml-2 bg-transparent border-none outline-none flex-1 font-mono"
                            autoFocus
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HeroSection;