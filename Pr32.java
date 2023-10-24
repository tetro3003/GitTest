import acm.program.ConsoleProgram;

public class Pr32 extends ConsoleProgram{
	
	public void run(){
		
		for(int i=1; i<=1000000; i++){
			simpleNumberChecker(i);
		}		
	}

	private void simpleNumberChecker(int number){
		
		int a = 0;

		for(int i = 0; i < number; i++ ){
			if(number%(i+1)==0){
				a++;
			}	
		}
		if(a==2) println(number);	
	}
}
