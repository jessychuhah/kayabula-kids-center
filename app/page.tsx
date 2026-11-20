"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

const programs = [
	{
		title: "Education & Career",
		text: "Education support, ICT awareness, career guidance and co-curricular activities.",
		icon: "01",
	},
	{
		title: "Health & Wellness",
		text: "Health care information, HIV testing support and sexual and reproductive health rights awareness.",
		icon: "02",
	},
	{
		title: "Basic Needs",
		text: "Practical assistance with food, clothing and essential items for vulnerable young people.",
		icon: "03",
	},
];

export default function Home() {
	const [menuOpen, setMenuOpen] = useState(false);
	const [sent, setSent] = useState(false);

	function submitWhatsApp(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const name = data.get("name");
		const contact = data.get("contact");
		const subject = data.get("subject");
		const message = data.get("message");
		const text = `Hello Kayabula Kids Centre,\n\nName: ${name}\nContact: ${contact}\nSubject: ${subject}\n\n${message}`;
		setSent(true);
		window.open(
			`https://wa.me/256760597356?text=${encodeURIComponent(text)}`,
			"_blank",
			"noopener,noreferrer"
		);
	}

	return (
		<>
			<header className="site-header">
				<div className="header-inner">
					<a
						className="brand"
						href="#top"
						aria-label="Kayabula Kids Centre home"
					>
						<Image
							src="/assets/logo.jpeg"
							alt="Kayabula Kids Centre logo"
							width={62}
							height={62}
							priority
						/>
						<span>
							<strong>KAYABULA</strong>
							<small>KIDS CENTRE</small>
						</span>
					</a>
					<button
						className="menu-button"
						type="button"
						aria-label="Toggle navigation"
						aria-expanded={menuOpen}
						onClick={() => setMenuOpen(!menuOpen)}
					>
						<span></span>
						<span></span>
						<span></span>
					</button>
					<nav
						className={menuOpen ? "nav open" : "nav"}
						aria-label="Main navigation"
					>
						<a
							href="#about"
							onClick={() => setMenuOpen(false)}
						>
							About
						</a>
						<a
							href="#programs"
							onClick={() => setMenuOpen(false)}
						>
							Programs
						</a>
						<a
							href="#impact"
							onClick={() => setMenuOpen(false)}
						>
							Our impact
						</a>
						<a
							href="#involved"
							onClick={() => setMenuOpen(false)}
						>
							Get involved
						</a>
						<a
							href="#contact"
							onClick={() => setMenuOpen(false)}
						>
							Contact
						</a>
						<a
							className="nav-donate"
							href="#donate"
							onClick={() => setMenuOpen(false)}
						>
							Donate
						</a>
					</nav>
				</div>
			</header>

			<main id="top">
				<section className="hero">
					<div className="hero-inner">
						<div className="hero-copy">
							<p className="eyebrow">
								<span></span> A youth & community support centre
							</p>
							<h1>
								Helping young people build{" "}
								<em>hopeful futures.</em>
							</h1>
							<p className="hero-lead">
								A safe, practical place for vulnerable young people ages 14–25
								to access education, health support and basic needs in Kampala.
							</p>
							<div className="hero-actions">
								<a
									className="button button-gold"
									href="#donate"
								>
									Support the centre <span>↗</span>
								</a>
								<a
									className="text-link"
									href="#about"
								>
									Discover our story <span>↓</span>
								</a>
							</div>
						</div>
						<div className="hero-photo">
							<div className="image-collage hero-collage">
								<div className="collage-main"><Image src="/assets/image-1.jpeg" alt="Kayabula community work" fill priority sizes="(max-width: 800px) 92vw, 34vw" /></div>
								<div><Image src="/assets/image-3.jpeg" alt="Young people supported by the centre" fill sizes="(max-width: 800px) 46vw, 16vw" /></div>
								<div><Image src="/assets/image-5.jpeg" alt="Community support activity" fill sizes="(max-width: 800px) 46vw, 16vw" /></div>
							</div>
							<div className="hero-badge"><strong>2020</strong><span>Founded in<br />Kampala</span></div>
						</div>
					</div>
				</section>

				<section className="impact-strip" id="impact" aria-label="Our impact">
					<div className="impact-inner">
						<div className="impact-stat"><strong>30+</strong><span>young people<br />supported</span></div>
						<div className="impact-stat"><strong>13</strong><span>families<br />supported</span></div>
						<div className="impact-stat"><strong>55</strong><span>villages reached<br />in Kampala District</span></div>
					</div>
				</section>

				<section className="about section" id="about">
					<div className="content-grid">
						<div className="about-image">
							<div className="image-collage about-collage">
								<div className="collage-main"><Image src="/assets/image-2.jpeg" alt="Kayabula community support" fill sizes="(max-width: 800px) 92vw, 24vw" /></div>
								<div><Image src="/assets/image-4.jpeg" alt="Education and support programme" fill sizes="(max-width: 800px) 46vw, 14vw" /></div>
								<div><Image src="/assets/image-6.jpeg" alt="Health and wellbeing activity" fill sizes="(max-width: 800px) 46vw, 14vw" /></div>
								<div><Image src="/assets/image-7.jpeg" alt="Basic needs support" fill sizes="(max-width: 800px) 46vw, 14vw" /></div>
							</div>
						</div>
						<div className="about-copy">
							<p className="section-kicker">About the centre</p>
							<h2>
								Care, dignity and opportunity for every young person.
							</h2>
							<p>
								Kayabula Kids Centre began in 2020 in Badongo Village, Kampala.
								We provide a welcoming community space where young people can
								strengthen their skills, improve their wellbeing and get practical
								support.
							</p>
							<p>
								Registration is currently in process as we work to build the
								resources needed for formal registration.
							</p>
							<div className="details-row">
								<div>
									<small>LOCATION</small>
									<strong>Sanyu Road, Kampala</strong>
								</div>
								<div>
									<small>HOURS</small>
									<strong>
										Monday–Saturday
										<br />
										9:00 AM–5:00 PM
									</strong>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section className="programs section" id="programs">
					<div className="section-heading">
						<div>
							<p className="section-kicker">What we do</p>
							<h2>Support for real-life needs.</h2>
						</div>
						<p>
							Our work brings practical help together with encouragement,
							information and community connection.
						</p>
					</div>
					<div className="program-grid">
						{programs.map((program) => (
							<article
								className="program-card"
								key={program.title}
							>
								<span className="program-number">{program.icon}</span>
								<h3>{program.title}</h3>
								<p>{program.text}</p>
								<a href="#contact">
									Learn more <span>→</span>
								</a>
							</article>
						))}
					</div>
				</section>

				<section className="story section">
					<div className="story-inner">
						<div className="story-copy">
							<p className="section-kicker light">Our shared purpose</p>
							<h2>A little support can open a bigger future.</h2>
							<p>
								We work alongside families and community members to help young
								people stay connected to learning, wellbeing and opportunity.
							</p>
							<a
								className="button button-cream"
								href="#involved"
							>
								Join our mission <span>↗</span>
							</a>
						</div>
						<div className="story-photo">
							<div className="image-collage story-collage">
								<div className="collage-main"><Image src="/assets/image-14.jpeg" alt="Kayabula youth community activity" fill sizes="(max-width: 800px) 92vw, 24vw" /></div>
								<div><Image src="/assets/image-10.jpeg" alt="Community impact activity" fill sizes="(max-width: 800px) 46vw, 16vw" /></div>
								<div><Image src="/assets/image-12.jpeg" alt="Young people at the centre" fill sizes="(max-width: 800px) 46vw, 16vw" /></div>
							</div>
						</div>
					</div>
				</section>

				<section className="donate section" id="donate">
					<div className="donate-inner">
						<div className="donate-copy">
							<p className="section-kicker">Give support</p>
							<h2>Help a young person take their next step.</h2>
							<p>
								Your support can help provide education, health information and
								essential needs within the community.
							</p>
							<div className="giving-list">
								<span>01</span>
								<p>
									<strong>Education</strong> ICT, books and career guidance
								</p>
							</div>
							<div className="giving-list">
								<span>02</span>
								<p>
									<strong>Wellness</strong> Health care and SRHR information
								</p>
							</div>
							<div className="giving-list">
								<span>03</span>
								<p>
									<strong>Basic needs</strong> Food and clothing support
								</p>
							</div>
						</div>
						<div className="payment-card">
							<p className="payment-title">Choose a payment option</p>
							<div className="payment-options">
								<button type="button">
									<b>MTN</b>
									<span>MoMo</span>
								</button>
								<button type="button">
									<b>AIRTEL</b>
									<span>Money</span>
								</button>
								<button type="button">
									<b>VISA</b>
									<span>Card</span>
								</button>
							</div>
							<div className="payment-warning">
								<strong>Checkout not active yet</strong>
								<p>
									Secure payment processing will begin after merchant accounts
									are approved. No payment is currently taken through this
									website.
								</p>
							</div>
							<a
								className="button button-purple"
								href="mailto:kayabulakidscentre@gmail.com?subject=Donation%20enquiry"
							>
								Ask about donating <span>↗</span>
							</a>
						</div>
					</div>
				</section>

				<section className="involved section" id="involved">
					<div className="section-heading">
						<div>
							<p className="section-kicker">Get involved</p>
							<h2>There are many ways to stand with us.</h2>
						</div>
					</div>
					<div className="involved-grid">
						<article>
							<span>01</span>
							<h3>Volunteer</h3>
							<p>
								Share your time and skills through activities, mentoring or
								community outreach.
							</p>
							<a href="#contact">Volunteer with us →</a>
						</article>
						<article>
							<span>02</span>
							<h3>Partner</h3>
							<p>
								Work with us to create practical learning and wellbeing
								opportunities.
							</p>
							<a href="#contact">Become a partner →</a>
						</article>
						<article>
							<span>03</span>
							<h3>Spread the word</h3>
							<p>
								Follow and share the centre&apos;s work through Instagram and your community.
							</p>
							<a
								href="https://instagram.com/kayabulakidscentre"
								target="_blank"
								rel="noreferrer"
							>
								Visit Instagram →
							</a>
						</article>
					</div>
				</section>

				<section className="contact section" id="contact">
					<div className="contact-inner">
						<div className="contact-copy">
							<p className="section-kicker light">In touch</p>
							<h2>Let&apos;s talk about how we can help.</h2>
							<div className="contact-list">
								<div>
									<small>CALL OR WHATSAPP</small>
									<a href="tel:+256760597356">0760 597356</a>
								</div>
								<div>
									<small>EMAIL</small>
									<a href="mailto:kayabulakidscentre@gmail.com">
										kayabulakidscentre@gmail.com
									</a>
								</div>
								<div>
									<small>VISIT</small>
									<span>Sanyu Road, Kampala</span>
								</div>
							</div>
						</div>
						<form
							className="contact-form"
							onSubmit={submitWhatsApp}
						>
							<div className="form-row">
								<label>
									Full name
									<input
										name="name"
										type="text"
										required
										placeholder="Your name"
									/>
								</label>
								<label>
									Phone or email
									<input
										name="contact"
										type="text"
										required
										placeholder="How to reach you"
									/>
								</label>
							</div>
							<label>
								Subject
								<input
									name="subject"
									type="text"
									required
									placeholder="Volunteering, partnership or support"
								/>
							</label>
							<label>
								Message
								<textarea
									name="message"
									required
									rows={5}
									placeholder="Tell us how we can help..."
								></textarea>
							</label>
							<button
								className="button button-gold"
								type="submit"
							>
								Send on WhatsApp <span>↗</span>
							</button>
							{sent && (
								<p className="form-status" role="status">
									WhatsApp is opening with your message.
								</p>
							)}
						</form>
					</div>
				</section>
			</main>

			<footer>
				<div className="footer-inner">
					<a className="footer-brand" href="#top">
						<Image
							src="/assets/logo.jpeg"
							alt=""
							width={54}
							height={54}
						/>
						<strong>Kayabula<br />Kids Centre</strong>
					</a>
					<p>Badongo Village · Sanyu Road · Kampala</p>
					<a
						href="https://instagram.com/kayabulakidscentre"
						target="_blank"
						rel="noreferrer"
					>
						Instagram ↗
					</a>
				</div>
			</footer>

			<a
				className="whatsapp-float"
				href="https://wa.me/256760597356"
				target="_blank"
				rel="noreferrer"
				aria-label="Chat on WhatsApp"
			>
				<span>WA</span>
			</a>
		</>
	);
}
