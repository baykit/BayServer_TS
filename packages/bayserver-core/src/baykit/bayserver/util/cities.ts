import {City} from "../docker/city";

export class Cities {

    /** Default city docker */
    private anyCity: City;

    /** City dockers */
    private cities: City[] = []

    add(c: City) {
        if(c.getName() == "*")
            this.anyCity = c;
        else
            this.cities.push(c);
    }

    findCity(name: string): City {
        // Check exact match
        for(const c of this.cities) {
            if(c.getName() == name)
            return c;
        }

        return this.anyCity;
    }

    getCities(): City[] {
        let ret: City[] = [...this.cities]
        if(this.anyCity != null)
            ret.push(this.anyCity);
        return ret;
    }

}