import css from "./Dashboard.sass?inline"
import {Lifecycle, TimeSpan} from "@opendaw/lib-std"
import {createElement, LocalLink} from "@opendaw/lib-jsx"
import {StudioService} from "@/service/StudioService.ts"
import {Html} from "@opendaw/lib-dom"
import {ProjectBrowser} from "@/project/ProjectBrowser"
import {showProcessMonolog} from "@/ui/components/dialogs"
import {Colors} from "@opendaw/studio-core"

const className = Html.adoptStyleSheet(css, "Dashboard")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
}

export const Dashboard = ({service}: Construct) => {
    const time = TimeSpan.millis(new Date(service.buildInfo.date).getTime() - new Date().getTime()).toUnitString()
    return (
        <div className={className}>
            <article>
                <h1>Welcome to Sona</h1>
                <h2>Generate bass, melody, percussion and chords for  ambient soundscapes, video game music, or any creative work with full customization</h2>

                <div className="columns">
                    <div>
                        <h3>Music Templates</h3>
                        <div className="starters">
                            {[
                                {name: "New", click: () => service.cleanSlate()},
                                {name: "Sunset", click: () => service.loadTemplate("Sunset")},
                                {name: "Breeze", click: () => service.loadTemplate("Breeze")},
                                {name: "Shafted", click: () => service.loadTemplate("Shafted")},
                                {name: "Seek Deeper", click: () => service.loadTemplate("SeekDeeper")},
                                {name: "Fatso", click: () => service.loadTemplate("Fatso")},
                                {name: "Bury Me", click: () => service.loadTemplate("BuryMe")},
                                {
                                    name: "Bury Me (BMX Remix)",
                                    click: () => service.loadTemplate("BMX_Skyence_buryme_Remix")
                                },
                                {name: "Ben", click: () => service.loadTemplate("Ben")},
                                {name: "Liquid", click: () => service.loadTemplate("BMX_LiquidDrums")},
                                {name: "Release", click: () => service.loadTemplate("Release")},
                                {name: "Dub Techno", click: () => service.loadTemplate("Dub-Techno")}
                            ].map(({name, click}, index) => (
                                <div onclick={click}>
                                    <img src={`viscious-speed/abstract-${String(index).padStart(3, "0")}.svg`} alt=""/>
                                    <label>{name}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3>Your Compositions</h3>
                        <ProjectBrowser service={service}
                                        select={async ([uuid, meta]) => {
                                            const handler = showProcessMonolog("Loading...")
                                            await service.sessionService.loadExisting(uuid, meta)
                                            handler.close()
                                        }}/>
                    </div>
                </div>

            </article>
        </div>
    )
}