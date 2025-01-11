import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const NormalMode = () => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="w-full max-w-4xl mx-auto mt-8">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full bg-gray-800 hover:bg-gray-700 text-green-400 p-4 rounded-lg border border-gray-700 transition-all duration-300 flex items-center justify-center space-x-2"
            >
                <span className="font-mono text-lg">
                    {isExpanded ? "Never mind, I'm a tech person!" : "Umm... I'm a normal person, just give me the info!"}
                </span>
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="mt-8 space-y-12 p-6 bg-gray-800 rounded-lg border border-gray-700">
                    {/* About Section */}
                    <section>
                        <h2 className="text-2xl font-bold text-green-400 mb-4">About Me</h2>
                        <p className="text-gray-300 leading-relaxed">
                            I&#39;m David Chandler, an Offensive Security Engineer specializing in Penetration Testing, Red Teaming,
                            and Vulnerability Assessment. With a passion for discovering vulnerabilities and strengthening
                            defensive capabilities, I help organizations improve their security posture through
                            adversary emulation and custom security tool development.
                        </p>
                    </section>

                    {/* Experience Section */}
                    <section>
                        <h2 className="text-2xl font-bold text-green-400 mb-4">Work Experience</h2>
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl text-gray-200">Offensive Security Engineer @ <a
                                    href={"https://www.emerson.com/en-us"}>Emerson</a></h3>
                                <p className="text-green-400 mb-2">Apr 2023 - Present</p>
                                <ul className="list-disc list-inside text-gray-300 space-y-2">
                                    <li>Leading pen-testing and red team engagements</li>
                                    <li>Developing custom offensive security tools</li>
                                    <li>Collaborating with the defensive team in Purple Team engagements</li>
                                    <li>Performing Threat Models with development teams</li>
                                    <li>Recent vulnerability and exploit analysis</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-xl text-gray-200">Attack Surface Security Analyst @ <a
                                    href={"https://www.emerson.com/en-us"}>Emerson</a></h3>
                                <p className="text-green-400 mb-2">Sep 2022 - Apr 2023</p>
                                <ul className="list-disc list-inside text-gray-300 space-y-2">
                                    <li>Managing perimeter security via discovery, analysis, remediation and
                                        monitoring
                                    </li>
                                    <li>Writing Python scripts to pull data from 3rd party APIs</li>
                                    <li>Creating visual reports based on attack surface findings</li>
                                    <li>Staying up to date on recent threats giving analysis on exploits</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-xl text-gray-200">IT Quality Assurance Analyst @ <a
                                    href={"https://www.ques.com/"}>QUES</a></h3>
                                <p className="text-green-400 mb-2">Oct 2020 - Sep 2022</p>
                                <ul className="list-disc list-inside text-gray-300 space-y-2">
                                    <li>Developing T-SQL stored procedures</li>
                                    <li>Writing and maintaining functional and UI automation tests</li>
                                    <li>Writing and maintaining an API load testing suite</li>
                                    <li>Lead QA tester on new applications</li>
                                    <li>Minor development work using Unity and Blender</li>
                                    <li>Working with developers by reviewing code + writing tests</li>
                                    <li>Auditing application security in down time + remediating issues</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Skills Section */}
                    <section>
                        <h2 className="text-2xl font-bold text-green-400 mb-4">Technical Skills</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <h3 className="text-xl text-gray-200">Programming Languages</h3>
                                <div className="flex flex-wrap gap-2">
                                    {['Python', 'Go', 'JavaScript', 'C', 'C#'].map((skill) => (
                                        <span key={skill}
                                              className="px-3 py-1 bg-gray-700 text-green-400 rounded-full text-sm">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl text-gray-200">Security Knowledge Domains</h3>
                                <div className="flex flex-wrap gap-2">
                                    {['Web', 'Network', 'Cloud', 'Software Dev'].map((tool) => (
                                        <span key={tool} className="px-3 py-1 bg-gray-700 text-green-400 rounded-full text-sm">
                                            {tool}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Certifications Section */}
                    <section>
                        <h2 className="text-2xl font-bold text-green-400 mb-4">Certifications</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                'CPTS - Certified Penetration Testing Specialist',
                                'Security+ - CompTia Sec+',
                            ].map((cert) => (
                                <div key={cert} className="flex items-center p-3 bg-gray-700 rounded-lg">
                                    <span className="text-gray-200">{cert}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Pro Labs Section */}
                    <section>
                        <h2 className="text-2xl font-bold text-green-400 mb-4">Hack The Box Pro Labs Completed</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                'BlackSky Hailstorm - Amazon Web Services',
                                'BlackSky Cyclone - Azure Environment',
                                'BlackSky Blizzard - Google Cloud Platform',
                            ].map((cert) => (
                                <div key={cert} className="flex items-center p-3 bg-gray-700 rounded-lg">
                                    <span className="text-gray-200">{cert}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Projects Section */}
                    <section>
                        <h2 className="text-2xl font-bold text-green-400 mb-4">Featured Projects</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gray-700 p-4 rounded-lg">
                                <h3 className="text-xl text-gray-200 mb-2">Hack The Box Academy to Markdown</h3>
                                <p className="text-gray-300 mb-3">Fetch down Academy modules as markdown files for local use, built with Go.</p>
                                <a href="https://github.com/Tut-k0/htb-academy-to-md"
                                   className="inline-flex items-center text-green-400 hover:text-green-300">
                                    View Project <ExternalLink size={16} className="ml-1" />
                                </a>
                            </div>
                            <div className="bg-gray-700 p-4 rounded-lg">
                                <h3 className="text-xl text-gray-200 mb-2">Game Role Attendant</h3>
                                <p className="text-gray-300 mb-3">A web app assisting in role-based hidden identity games. Built with Node.js as the Backend, and Quasar Vue as the Frontend.</p>
                                <a href="https://github.com/dme998/game-role-attendant"
                                   className="inline-flex items-center text-green-400 hover:text-green-300">
                                    View Project <ExternalLink size={16} className="ml-1" />
                                </a>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default NormalMode;